import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { handleControllerError } from "../lib/errors.js";
import { getFiscalYearRange } from "../lib/fiscal-year.js";
import { getAccountBalances, dateToMonthStr } from "./transaction.controller.js";

function getMonthRange(from: string, to: string): string[] {
  const [y1, m1] = from.split('-').map(Number);
  const [y2, m2] = to.split('-').map(Number);
  const months: string[] = [];
  let y = y1, m = m1;
  while (y < y2 || (y === y2 && m <= m2)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

export const getAGMReport = async (req: Request, res: Response) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const { start, end } = getFiscalYearRange(year);

    const where = {
      isCancelled: false,
      reversalOfId: null,
      transactionDate: { gte: start, lte: end } as any,
    };

    const [incomeByCat, expenseByCat, transferAgg, openingRows, balancesRaw] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['category'],
        where: { ...where, transactionType: 'INCOME', affectsIncomeLedger: true },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
      }),
      prisma.transaction.groupBy({
        by: ['category'],
        where: { ...where, transactionType: 'EXPENSE', affectsExpenseLedger: true },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
      }),
      prisma.transaction.aggregate({
        where: { ...where, transactionType: 'INTERNAL_TRANSFER' },
        _count: true,
        _sum: { amount: true },
      }),
      prisma.openingBalance.findMany({ where: { fiscalYear: year } }),
      getAccountBalances(start, end),
    ]);

    const opening: Record<string, number> = { AL_RAWA_BANK: 0, GLOBAL_FORUM_BANK: 0, CASH_IN_HAND: 0 };
    openingRows.forEach(o => { opening[o.account] = Number(o.amount); });

    const b = balancesRaw[0];
    const closing = {
      AL_RAWA_BANK: Number(b.al_rawa) + opening.AL_RAWA_BANK,
      GLOBAL_FORUM_BANK: Number(b.global_forum) + opening.GLOBAL_FORUM_BANK,
      CASH_IN_HAND: Number(b.cash) + opening.CASH_IN_HAND,
    };

    const totalIncome = incomeByCat.reduce((s, g) => s + Number(g._sum.amount), 0);
    const totalExpense = expenseByCat.reduce((s, g) => s + Number(g._sum.amount), 0);

    res.json({
      fiscalYear: year,
      period: { start, end },
      income: incomeByCat.map((g) => [g.category || 'Uncategorized', Number(g._sum.amount)] as [string, number]),
      expense: expenseByCat.map((g) => [g.category || 'Uncategorized', Number(g._sum.amount)] as [string, number]),
      totalIncome,
      totalExpense,
      netSurplus: totalIncome - totalExpense,
      opening,
      closing,
      totalAssets: closing.AL_RAWA_BANK + closing.GLOBAL_FORUM_BANK + closing.CASH_IN_HAND,
      totalTransfers: Number(transferAgg._sum?.amount) || 0,
      transferCount: transferAgg._count || 0,
    });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

async function fetchDefaulterData(where: any, studentIds: string[]) {
  const [allocations, feeSchedules, studentFeeAssignments, activeWaivers] = await Promise.all([
    prisma.paymentAllocation.findMany({
      where: { studentId: { in: studentIds } },
      include: { transaction: { select: { isCancelled: true, reversalOfId: true } } },
    }),
    prisma.feeSchedule.findMany({ take: 5000 }),
    prisma.studentFeeAssignment.findMany({
      where: { active: true, studentId: { in: studentIds } },
    }),
    prisma.feeWaiver.findMany({
      where: { active: true, studentId: { in: studentIds } },
    }),
  ]);

  const validAllocations = allocations.filter(a => !a.transaction.isCancelled && !a.transaction.reversalOfId);
  const paidMap = new Map<string, number>();
  validAllocations.forEach(a => {
    const period = a.period || dateToMonthStr(new Date());
    const key = `${a.studentId}|${a.feeScheduleId || ''}|${period}`;
    paidMap.set(key, (paidMap.get(key) || 0) + Number(a.amount));
  });

  const feeScheduleMap = new Map(feeSchedules.map(f => [f.id, f]));
  const schedulesByClass = new Map<string | null, typeof feeSchedules>();
  for (const fs of feeSchedules) {
    const key = fs.classId ?? '__ALL__';
    if (!schedulesByClass.has(key)) schedulesByClass.set(key, []);
    schedulesByClass.get(key)!.push(fs);
  }

  const assignMap = new Map<string, { startsAt: string | null; endsAt: string | null }>();
  studentFeeAssignments.forEach(a => assignMap.set(`${a.studentId}|${a.feeScheduleId}`, { startsAt: dateToMonthStr(a.startsAt), endsAt: dateToMonthStr(a.endsAt) }));

  const waiverMap = new Map<string, typeof activeWaivers[0]>();
  activeWaivers.forEach(w => waiverMap.set(`${w.studentId}|${w.feeScheduleId}`, w));

  return { paidMap, feeScheduleMap, schedulesByClass, assignMap, waiverMap };
}

function getExpectedAmount(studentId: string, fsId: string | undefined, feeScheduleMap: Map<string, any>, waiverMap: Map<string, any>): number {
  const fs = fsId ? feeScheduleMap.get(fsId) : undefined;
  const baseAmount = fs ? Number(fs.amount) : 0;
  if (!fs) return baseAmount;
  const waiver = waiverMap.get(`${studentId}|${fs.id}`);
  if (!waiver) return baseAmount;
  if (waiver.type === 'FULL') return 0;
  if (waiver.type === 'PERCENTAGE') return baseAmount - (baseAmount * Number(waiver.value) / 100);
  if (waiver.type === 'FIXED_AMOUNT') return Math.max(0, baseAmount - Number(waiver.value));
  if (waiver.type === 'CUSTOM_AMOUNT') return Number(waiver.value);
  return baseAmount;
}

function isMonthInAssignment(monthStr: string, assign: { startsAt: string | null; endsAt: string | null } | undefined): boolean {
  if (!assign) return false;
  if (assign.startsAt && monthStr < assign.startsAt) return false;
  if (assign.endsAt && monthStr > assign.endsAt) return false;
  return true;
}

export const getHeadwiseReport = async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, type } = req.query;
    const txnType = String(type || 'INCOME').toUpperCase();
    if (!['INCOME', 'EXPENSE'].includes(txnType)) {
      return res.status(400).json({ error: 'type must be INCOME or EXPENSE' });
    }
    const where: any = {
      isCancelled: false,
      reversalOfId: null,
      transactionType: txnType,
      ...(txnType === 'INCOME' ? { affectsIncomeLedger: true } : { affectsExpenseLedger: true }),
    };
    if (dateFrom || dateTo) {
      where.transactionDate = {};
      if (dateFrom) where.transactionDate.gte = new Date(String(dateFrom));
      if (dateTo) where.transactionDate.lte = new Date(String(dateTo) + 'T23:59:59Z');
    }

    const [grouped, totalAgg, rows] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['category'],
        where,
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
      }),
      prisma.transaction.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),
      txnType === 'INCOME' ? prisma.transaction.findMany({
        where: { ...where, category: { not: null } },
        select: { category: true, student: { select: { name: true } } },
      }) : Promise.resolve([]),
    ]);

    const studentMap = new Map<string, Set<string>>();
    if (txnType === 'INCOME') {
      for (const r of rows) {
        const cat = r.category || 'Uncategorized';
        if (!studentMap.has(cat)) studentMap.set(cat, new Set());
        if (r.student?.name) studentMap.get(cat)!.add(r.student.name);
      }
    }

    const categories = grouped.map((g) => ({
      category: g.category || 'Uncategorized',
      total: Number(g._sum.amount) || 0,
      count: g._count,
      uniqueStudents: txnType === 'INCOME' ? (studentMap.get(g.category || 'Uncategorized')?.size || 0) : 0,
    }));

    res.json({
      categories,
      grandTotal: Number(totalAgg._sum.amount) || 0,
      grandCount: totalAgg._count || 0,
    });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const getMonthlyTransactions = async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, type } = req.query;
    const txnType = String(type || 'INCOME').toUpperCase();
    if (!['INCOME', 'EXPENSE'].includes(txnType)) {
      return res.status(400).json({ error: 'type must be INCOME or EXPENSE' });
    }
    const where: any = {
      isCancelled: false,
      reversalOfId: null,
      transactionType: txnType,
      ...(txnType === 'INCOME' ? { affectsIncomeLedger: true } : { affectsExpenseLedger: true }),
    };
    if (dateFrom || dateTo) {
      where.transactionDate = {};
      if (dateFrom) where.transactionDate.gte = new Date(String(dateFrom));
      if (dateTo) where.transactionDate.lte = new Date(String(dateTo) + 'T23:59:59Z');
    }

    const [transactions, totalAgg] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { transactionDate: 'asc' },
        select: {
          id: true,
          transactionDate: true,
          className: true,
          category: true,
          description: true,
          amount: true,
          student: { select: { name: true, class: true } },
        },
      }),
      prisma.transaction.aggregate({ where, _sum: { amount: true } }),
    ]);

    res.json({
      transactions,
      grandTotal: Number(totalAgg._sum.amount) || 0,
    });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const getAuditReport = async (req: Request, res: Response) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const { start, end } = getFiscalYearRange(year);

    const where = {
      isCancelled: false,
      reversalOfId: null,
      transactionDate: { gte: start, lte: end } as any,
    };

    const [incomeByCat, expenseByCat, incomeAgg, expenseAgg] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['category'],
        where: { ...where, transactionType: 'INCOME', affectsIncomeLedger: true },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
      }),
      prisma.transaction.groupBy({
        by: ['category'],
        where: { ...where, transactionType: 'EXPENSE', affectsExpenseLedger: true },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
      }),
      prisma.transaction.aggregate({
        where: { ...where, transactionType: 'INCOME', affectsIncomeLedger: true },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { ...where, transactionType: 'EXPENSE', affectsExpenseLedger: true },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = Number(incomeAgg._sum.amount) || 0;
    const totalExpense = Number(expenseAgg._sum.amount) || 0;

    res.json({
      fiscalYear: year,
      totalIncome,
      totalExpense,
      netSurplus: totalIncome - totalExpense,
      incomeByCategory: incomeByCat.map((g) => [g.category || 'Uncategorized', Number(g._sum.amount)]),
      expenseByCategory: expenseByCat.map((g) => [g.category || 'Uncategorized', Number(g._sum.amount)]),
    });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    const fiscalYear = Number(req.query.fiscalYear) || new Date().getFullYear();
    const { start, end } = getFiscalYearRange(fiscalYear);

    const where = {
      isCancelled: false,
      reversalOfId: null,
      transactionDate: { gte: start, lte: end } as any,
    };

    const [incomeAgg, depositAgg] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          ...where,
          transactionType: 'INCOME',
          destinationAccount: { in: ['CASH_IN_HAND', 'AL_RAWA_BANK'] },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          ...where,
          sourceAccount: 'CASH_IN_HAND',
          destinationAccount: 'AL_RAWA_BANK',
        },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = Number(incomeAgg._sum.amount) || 0;
    const totalDepositedToBank = Number(depositAgg._sum.amount) || 0;

    res.json({
      totalIncome,
      totalDepositedToBank,
      depositRemaining: totalIncome - totalDepositedToBank,
    });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const getDefaulterReport = async (req: Request, res: Response) => {
  try {
    const { className, studentId, feeCategory, monthFrom, monthTo, year } = req.query;

    const students = await prisma.student.findMany({
      where: {
        ...(className ? { class: String(className) } : {}),
        ...(studentId ? { id: String(studentId) } : {}),
      },
      orderBy: [{ class: "asc" }, { name: "asc" }],
      take: 5000,
    });

    const { paidMap, feeScheduleMap, schedulesByClass, assignMap, waiverMap } = await fetchDefaulterData({}, students.map(s => s.id));

    const result = students.map(student => {
      const fees: any[] = [];

      const applicableSchedules = [
        ...(schedulesByClass.get(student.classId) || []),
        ...(schedulesByClass.get('__ALL__') || []),
      ].filter(fs => fs.applicability !== 'ASSIGNED_ONLY' || assignMap.has(`${student.id}|${fs.id}`));

      const scheduleByCat = new Map<string, any>();
      for (const fs of applicableSchedules) {
        const existing = scheduleByCat.get(fs.category);
        if (!existing || (fs.classId !== null && existing.classId === null)) {
          scheduleByCat.set(fs.category, fs);
        }
      }

      if (monthFrom && monthTo) {
        const months = getMonthRange(String(monthFrom), String(monthTo));
        for (const [cat, fs] of scheduleByCat) {
          if (feeCategory && feeCategory !== cat) continue;
          if (fs.frequency !== 'MONTHLY') continue;
          const defaultAmt = getExpectedAmount(student.id, fs.id, feeScheduleMap, waiverMap);
          if (defaultAmt <= 0) continue;
          const assignment = assignMap.get(`${student.id}|${fs.id}`);
          const monthDetail = months
            .filter(m => fs.applicability !== 'ASSIGNED_ONLY' || isMonthInAssignment(m, assignment))
            .map(m => {
              const key = `${student.id}|${fs.id}|${m}`;
              const paidAmt = paidMap.get(key) || 0;
              return { month: m, paid: paidAmt >= defaultAmt, paidAmt, amount: defaultAmt };
            });
          if (monthDetail.length === 0) continue;
          fees.push({
            name: cat, type: 'recurring', amount: defaultAmt,
            totalDue: defaultAmt * monthDetail.length,
            totalPaid: monthDetail.reduce((s, m) => s + m.paidAmt, 0),
            months: monthDetail,
          });
        }
      }

      if (year) {
        for (const [cat, fs] of scheduleByCat) {
          if (feeCategory && feeCategory !== cat) continue;
          if (fs.frequency !== 'YEARLY' && fs.frequency !== 'ONETIME') continue;
          const defaultAmt = getExpectedAmount(student.id, fs.id, feeScheduleMap, waiverMap);
          if (defaultAmt <= 0) continue;
          const key = `${student.id}|${fs.id}|${String(year)}`;
          const paidAmt = paidMap.get(key) || 0;
          fees.push({
            name: cat, type: 'onetime', amount: defaultAmt,
            totalDue: defaultAmt,
            totalPaid: paidAmt,
            paid: paidAmt >= defaultAmt,
            year: Number(year),
          });
        }
      }

      const totalDue = fees.reduce((s, f) => s + f.totalDue, 0);
      const totalPaid = fees.reduce((s, f) => s + f.totalPaid, 0);

      return {
        studentId: student.id,
        name: student.name,
        fatherName: student.fatherName,
        class: student.class,
        studentIdNumber: student.studentId,
        fees,
        totalDue,
        totalPaid,
        balance: totalDue - totalPaid,
      };
    });

    res.json(result);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};