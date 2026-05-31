import type { Request, Response } from "express";
import { classifyTransaction } from "../lib/finance-rules.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError } from "../lib/errors.js";
import { validate, createTransactionSchema } from "../lib/validate.js";
import { logAudit } from "../lib/audit.js";
import { getFiscalYearForDate, getFiscalYearRange } from "../lib/fiscal-year.js";
import { param } from "../lib/param.js";

export const createTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const validation = validate(createTransactionSchema, req.body);
    if (!validation.success) return res.status(400).json({ error: validation.error });
    const {
      date,
      amount,
      sourceAccount,
      destinationAccount,
      category,
      description,
      referenceId,
      totalIncomeCollected,
      directExpenseBeforeDeposit,
      studentId,
      className,
      feeMonth,
      feeScheduleId: reqFeeScheduleId,
    } = validation.data;

    const fiscalYear = getFiscalYearForDate(new Date(date));
    const closedPeriod = await prisma.periodClose.findFirst({
      where: { fiscalYear },
    });
    if (closedPeriod) {
      return res.status(403).json({ error: `Fiscal year ${fiscalYear} is closed. No new transactions can be added.` });
    }

    const { transactionType, affectsIncomeLedger, affectsExpenseLedger } =
      classifyTransaction(sourceAccount ?? undefined, destinationAccount ?? undefined);

    if (studentId && feeMonth && category) {
      const existing = await prisma.transaction.findFirst({
        where: { studentId, category, feeMonth, isCancelled: false },
      });
      if (existing) {
        return res.status(409).json({ error: `${category} for ${feeMonth} is already recorded for this student` });
      }
    }

    if (referenceId) {
      const existing = await prisma.transaction.findFirst({ where: { referenceId } });
      if (existing) {
        return res.status(409).json({ error: `Transaction with referenceId "${referenceId}" already exists`, existing });
      }
    }

    let finalAmount = Number(amount);
    let note = description || "";

    if (totalIncomeCollected && directExpenseBeforeDeposit) {
      const collected = Number(totalIncomeCollected);
      const emergency = Number(directExpenseBeforeDeposit);
      finalAmount = collected - emergency;
      note = `${note ? note + " — " : ""}Income ৳${collected.toLocaleString()}, Emergency expense ৳${emergency.toLocaleString()}, Net deposit ৳${finalAmount.toLocaleString()}`.trim();
    }

    // Resolve feeScheduleId: prefer explicit from request, fall back to category+class lookup
    let feeScheduleId: string | null = reqFeeScheduleId ?? null;
    if (!feeScheduleId && studentId && category && className) {
      const sched = await prisma.feeSchedule.findFirst({
        where: { category, classRel: { name: className } },
        select: { id: true },
      });
      feeScheduleId = sched?.id ?? null;
    }
    if (feeScheduleId && studentId) {
      const fs = await prisma.feeSchedule.findUnique({ where: { id: feeScheduleId }, select: { id: true, applicability: true } });
      if (!fs) {
        return res.status(400).json({ error: `Fee schedule "${feeScheduleId}" not found` });
      }
      if (fs.applicability === 'ASSIGNED_ONLY') {
        const assigned = await prisma.studentFeeAssignment.findFirst({
          where: { studentId, feeScheduleId, active: true },
          select: { id: true, startsAt: true, endsAt: true },
        });
        if (!assigned) {
          return res.status(400).json({ error: `Fee schedule is assigned-only and this student has no active assignment` });
        }
        if (feeMonth && assigned.startsAt) {
          const startStr = dateToMonthStr(assigned.startsAt);
          if (startStr && feeMonth < startStr) {
            return res.status(400).json({ error: `Fee month ${feeMonth} is before the assignment start date` });
          }
        }
        if (feeMonth && assigned.endsAt) {
          const endStr = dateToMonthStr(assigned.endsAt);
          if (endStr && feeMonth > endStr) {
            return res.status(400).json({ error: `Fee month ${feeMonth} is after the assignment end date` });
          }
        }
      }
    }

    const [transaction] = await prisma.$transaction(async (tx) => {
      const t = await tx.transaction.create({
        data: {
          transactionDate: new Date(date),
          amount: finalAmount,
          transactionType,
          sourceAccount: sourceAccount || null,
          destinationAccount: destinationAccount || null,
          category: category || null,
          description: note || null,
          studentId: studentId || null,
          className: className || null,
          affectsIncomeLedger,
          affectsExpenseLedger,
          referenceId: referenceId || null,
          feeMonth: feeMonth || null,
          createdBy: req.session?.user?.id || "system",
        },
      });

      if (studentId) {
        await tx.paymentAllocation.create({
          data: {
            transactionId: t.id,
            studentId,
            feeScheduleId,
            period: feeMonth || undefined,
            amount: finalAmount,
          },
        });
      }

      return [t];
    });

    logAudit({ userId: req.session?.user?.id, action: "CREATE", entityType: "Transaction", entityId: transaction.id, details: JSON.stringify({ amount: finalAmount, transactionType, category, studentId }) });

    res.status(201).json(transaction);
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};

export const getBalances = async (req: Request, res: Response) => {
  try {
    const { year } = req.query;
    const fiscalYear = year ? Number(year) : new Date().getFullYear();
    const { start, end } = getFiscalYearRange(fiscalYear);

    const rows = await prisma.$queryRaw<[{ al_rawa: string | null; global_forum: string | null; cash: string | null }]>`
      SELECT
        COALESCE(SUM(CASE WHEN destination_account = 'AL_RAWA_BANK' THEN amount
                         WHEN source_account = 'AL_RAWA_BANK' THEN -amount ELSE 0 END), 0) AS al_rawa,
        COALESCE(SUM(CASE WHEN destination_account = 'GLOBAL_FORUM_BANK' THEN amount
                         WHEN source_account = 'GLOBAL_FORUM_BANK' THEN -amount ELSE 0 END), 0) AS global_forum,
        COALESCE(SUM(CASE WHEN destination_account = 'CASH_IN_HAND' THEN amount
                         WHEN source_account = 'CASH_IN_HAND' THEN -amount ELSE 0 END), 0) AS cash
      FROM transactions WHERE is_cancelled = false AND reversal_of_id IS NULL
        AND transaction_date >= ${start} AND transaction_date <= ${end}
    `;
    const r = rows[0];

    const openingRows = await prisma.openingBalance.findMany({ where: { fiscalYear: String(fiscalYear) } });
    const opening: Record<string, number> = { AL_RAWA_BANK: 0, GLOBAL_FORUM_BANK: 0, CASH_IN_HAND: 0 };
    openingRows.forEach(o => { opening[o.account] = Number(o.amount); });

    res.json({
      AL_RAWA_BANK: Number(r.al_rawa) + opening.AL_RAWA_BANK,
      GLOBAL_FORUM_BANK: Number(r.global_forum) + opening.GLOBAL_FORUM_BANK,
      CASH_IN_HAND: Number(r.cash) + opening.CASH_IN_HAND,
      opening,
    });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

// ── Opening Balances (Approach 3: stored per fiscal year, user-settable, with history for backtrack) ──

export const getOpeningBalances = async (req: Request, res: Response) => {
  try {
    const { year } = req.query;
    const fiscalYear = year ? String(year) : String(new Date().getFullYear());
    const rows = await prisma.openingBalance.findMany({ where: { fiscalYear } });
    const result: Record<string, number> = { AL_RAWA_BANK: 0, GLOBAL_FORUM_BANK: 0, CASH_IN_HAND: 0 };
    rows.forEach(r => { result[r.account] = Number(r.amount); });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const setOpeningBalances = async (req: AuthRequest, res: Response) => {
  try {
    const { year, balances } = req.body;
    const fiscalYear = year ? String(year) : String(new Date().getFullYear());
    if (!balances || typeof balances !== 'object') {
      return res.status(400).json({ error: 'balances object required' });
    }
    const userId = req.session?.user?.id || 'system';
    const accounts = ['AL_RAWA_BANK', 'GLOBAL_FORUM_BANK', 'CASH_IN_HAND'];
    const updates: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const account of accounts) {
        const newAmount = Number(balances[account]) || 0;
        const existing = await tx.openingBalance.findUnique({
          where: { fiscalYear_account: { fiscalYear, account } },
        });
        const oldAmount = existing ? Number(existing.amount) : 0;
        if (oldAmount !== newAmount) {
          await tx.openingBalance.upsert({
            where: { fiscalYear_account: { fiscalYear, account } },
            update: { amount: newAmount, updatedBy: userId },
            create: { fiscalYear, account, amount: newAmount, updatedBy: userId },
          });
          await tx.openingBalanceHistory.create({
            data: { fiscalYear, account, oldAmount, newAmount, changedBy: userId },
          });
          updates.push({ account, oldAmount, newAmount });
        }
      }
    });

    res.json({ message: 'Opening balances updated', updates });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const getOpeningBalanceHistory = async (req: Request, res: Response) => {
  try {
    const { year, account } = req.query;
    const where: any = {};
    if (year) where.fiscalYear = String(year);
    if (account) where.account = String(account);
    const history = await prisma.openingBalanceHistory.findMany({
      where,
      orderBy: { changedAt: 'desc' },
      take: 100,
    });
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const revertOpeningBalance = async (req: AuthRequest, res: Response) => {
  try {
    const historyId = req.params.id as string;
    const entry = await prisma.openingBalanceHistory.findUnique({ where: { id: historyId } });
    if (!entry) return res.status(404).json({ error: 'History entry not found' });

    const userId = req.session?.user?.id || 'system';
    await prisma.$transaction(async (tx) => {
      await tx.openingBalance.upsert({
        where: { fiscalYear_account: { fiscalYear: entry.fiscalYear, account: entry.account } },
        update: { amount: entry.oldAmount, updatedBy: userId },
        create: { fiscalYear: entry.fiscalYear, account: entry.account, amount: entry.oldAmount, updatedBy: userId },
      });
      await tx.openingBalanceHistory.create({
        data: {
          fiscalYear: entry.fiscalYear,
          account: entry.account,
          oldAmount: entry.newAmount,
          newAmount: entry.oldAmount,
          changedBy: userId,
        },
      });
    });

    res.json({ message: 'Reverted successfully', fiscalYear: entry.fiscalYear, account: entry.account, amount: Number(entry.oldAmount) });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, type } = req.query;
    const where: any = {};
    if (dateFrom || dateTo) {
      where.transactionDate = {};
      if (dateFrom) where.transactionDate.gte = new Date(String(dateFrom));
      if (dateTo) where.transactionDate.lte = new Date(String(dateTo) + 'T23:59:59Z');
    }
    if (type && type !== 'all') where.transactionType = String(type);
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
      include: { student: { select: { id: true, name: true, class: true, roll: true } } },
    });
    res.json(transactions);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const cancelTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "Reason is required to cancel a transaction" });

    const tx = await prisma.transaction.findUnique({ where: { id }, include: { student: { select: { id: true, name: true, class: true, roll: true } } } });
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    if (tx.isCancelled) return res.status(400).json({ error: "Transaction already cancelled" });

    const fiscalYear = getFiscalYearForDate(new Date(tx.transactionDate));
    const closedPeriod = await prisma.periodClose.findFirst({
      where: { fiscalYear },
    });
    if (closedPeriod) {
      return res.status(403).json({ error: `Fiscal year ${fiscalYear} is closed. Transactions in this period cannot be cancelled.` });
    }

    const userId = req.session?.user?.id || "system";
    const studentName = (tx as any).student?.name || null;
    const studentClass = (tx as any).className || (tx as any).student?.class || null;

    // Classify the reversal with swapped accounts
    const { transactionType, affectsIncomeLedger, affectsExpenseLedger } =
      classifyTransaction(tx.destinationAccount || undefined, tx.sourceAccount || undefined);

    const [cancelled, reversal] = await prisma.$transaction([
      // Mark original as cancelled
      prisma.transaction.update({
        where: { id },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          cancelledBy: userId,
          cancelReason: reason || null,
        },
      }),
      // Create reversal entry with swapped accounts
      prisma.transaction.create({
        data: {
          transactionDate: new Date(),
          amount: tx.amount,
          transactionType,
          sourceAccount: tx.destinationAccount || null,
          destinationAccount: tx.sourceAccount || null,
          category: `Reversal - ${tx.category || "Uncategorized"}`,
          description: `Cancelled: ${tx.description || tx.category || "Transaction"}${studentName ? ` (${studentClass || ''} - ${studentName})` : ""}${reason ? `. Reason: ${reason}` : ""}`,
          studentId: tx.studentId,
          className: studentClass,
          feeMonth: tx.feeMonth,
          affectsIncomeLedger,
          affectsExpenseLedger,
          reversalOfId: tx.id,
          createdBy: userId,
        },
      }),
    ]);

    logAudit({ userId, action: "CANCEL", entityType: "Transaction", entityId: id, details: JSON.stringify({ reason, reversalId: reversal.id }) });
    res.json({ cancelled, reversal });
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};

// ── Defaulter Report ──

function dateToMonthStr(d: Date | null): string | null {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Helper: get month range between two YYYY-MM strings
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

export const getDefaulterReport = async (req: Request, res: Response) => {
  try {
    const { className, studentId, feeCategory, monthFrom, monthTo, year } = req.query;

    const students = await prisma.student.findMany({
      where: {
        ...(className ? { class: String(className) } : {}),
        ...(studentId ? { id: String(studentId) } : {}),
      },
      orderBy: [{ class: "asc" }, { name: "asc" }],
    });

    const studentIds = students.map(s => s.id);

    // ── Use PaymentAllocation as source of truth for paid amounts ──
    const allocations = await prisma.paymentAllocation.findMany({
      where: { studentId: { in: studentIds } },
      include: { transaction: { select: { isCancelled: true, reversalOfId: true } } },
    });
    const validAllocations = allocations.filter(a => !a.transaction.isCancelled && !a.transaction.reversalOfId);

    // Build per-student per-schedule per-month paid map
    const paidMap = new Map<string, number>();
    validAllocations.forEach(a => {
      const period = a.period || dateToMonthStr(new Date());
      const key = `${a.studentId}|${a.feeScheduleId || ''}|${period}`;
      paidMap.set(key, (paidMap.get(key) || 0) + Number(a.amount));
    });

    // Fetch fee schedules, assignments, and active waivers
    const feeSchedules = await prisma.feeSchedule.findMany();
    const studentFeeAssignments = await prisma.studentFeeAssignment.findMany({
      where: { active: true, studentId: { in: studentIds } },
    });
    const assignMap = new Map<string, { startsAt: string | null; endsAt: string | null }>();
    studentFeeAssignments.forEach(a => assignMap.set(`${a.studentId}|${a.feeScheduleId}`, { startsAt: dateToMonthStr(a.startsAt), endsAt: dateToMonthStr(a.endsAt) }));

    function isMonthInAssignment(monthStr: string, assign: { startsAt: string | null; endsAt: string | null } | undefined): boolean {
      if (!assign) return false;
      if (assign.startsAt && monthStr < assign.startsAt) return false;
      if (assign.endsAt && monthStr > assign.endsAt) return false;
      return true;
    }

    const activeWaivers = await prisma.feeWaiver.findMany({
      where: { active: true, studentId: { in: studentIds } },
    });
    const waiverMap = new Map<string, typeof activeWaivers[0]>();
    activeWaivers.forEach(w => waiverMap.set(`${w.studentId}|${w.feeScheduleId}`, w));

    // Resolve expected amount: fee schedule → waiver → fallback
    const getExpectedAmount = (studentId: string, fsId?: string): number => {
      const fs = fsId ? feeSchedules.find(f => f.id === fsId) : undefined;
      const baseAmount = fs ? Number(fs.amount) : 0;
      if (!fs) return baseAmount;
      const waiver = waiverMap.get(`${studentId}|${fs.id}`);
      if (!waiver) return baseAmount;
      if (waiver.type === 'FULL') return 0;
      if (waiver.type === 'PERCENTAGE') return baseAmount - (baseAmount * Number(waiver.value) / 100);
      if (waiver.type === 'FIXED_AMOUNT') return Math.max(0, baseAmount - Number(waiver.value));
      if (waiver.type === 'CUSTOM_AMOUNT') return Number(waiver.value);
      return baseAmount;
    };

    const result = students.map(student => {
      const fees: any[] = [];

      // Determine applicable fee schedules for this student
      const applicableSchedules = feeSchedules.filter(fs => {
        if (fs.classId !== null && fs.classId !== student.classId) return false;
        if (fs.applicability === 'AUTO') return true;
        if (fs.applicability === 'ASSIGNED_ONLY') return assignMap.has(`${student.id}|${fs.id}`);
        return false;
      });

      const scheduleByCat = new Map<string, typeof feeSchedules[0]>();
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
          const defaultAmt = getExpectedAmount(student.id, fs.id);
          if (defaultAmt <= 0) continue;
          const assignment = assignMap.get(`${student.id}|${fs.id}`);
          const monthDetail = months
            .filter(m => isMonthInAssignment(m, assignment))
            .map(m => {
              const key = `${student.id}|${fs.id}|${m}`;
              const paidAmt = paidMap.get(key) || 0;
              return { month: m, paid: paidAmt >= defaultAmt, paidAmt, amount: defaultAmt };
            });
          const unpaidCount = monthDetail.filter(m => !m.paid).length;
          if (monthDetail.length === 0) continue;
          fees.push({
            name: cat, type: 'recurring', amount: defaultAmt,
            totalDue: defaultAmt * unpaidCount,
            totalPaid: monthDetail.reduce((s, m) => s + (m.paid ? defaultAmt : 0), 0),
            months: monthDetail,
          });
        }
      }

      // ── One-time fees (frequency: YEARLY or ONETIME) ──
      if (year) {
        for (const [cat, fs] of scheduleByCat) {
          if (feeCategory && feeCategory !== cat) continue;
          if (fs.frequency !== 'YEARLY' && fs.frequency !== 'ONETIME') continue;
          const defaultAmt = getExpectedAmount(student.id, fs.id);
          if (defaultAmt <= 0) continue;
          const key = `${student.id}|${fs.id}|${String(year)}`;
          const paidAmt = paidMap.get(key) || 0;
          const paid = paidAmt >= defaultAmt;
          fees.push({
            name: cat, type: 'onetime', amount: defaultAmt,
            totalDue: paid ? 0 : defaultAmt,
            totalPaid: paid ? defaultAmt : 0,
            paid,
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
        roll: student.roll,
        fees,
        totalDue,
        totalPaid,
        balance: totalDue - totalPaid,
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

function headwise(tx: any[]): [string, number][] {
  const map: Record<string, number> = {};
  tx.forEach(t => {
    const cat = t.category || 'Uncategorized';
    map[cat] = (map[cat] || 0) + Number(t.amount);
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

// ── AGM Report (server-side, year-bounded) ──

export const getAGMReport = async (req: Request, res: Response) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const { start, end } = getFiscalYearRange(year);

    const tx = await prisma.transaction.findMany({
      where: {
        isCancelled: false,
        reversalOfId: null,
        transactionDate: { gte: start, lte: end },
      },
      orderBy: { transactionDate: 'asc' },
    });

    const income = tx.filter((t: any) => t.transactionType === 'INCOME' && t.affectsIncomeLedger);
    const expense = tx.filter((t: any) => t.transactionType === 'EXPENSE' && t.affectsExpenseLedger);
    const transfers = tx.filter((t: any) => t.transactionType === 'INTERNAL_TRANSFER');

    const totalIncome = income.reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalExpense = expense.reduce((s: number, t: any) => s + Number(t.amount), 0);
    const netSurplus = totalIncome - totalExpense;

    const openingRows = await prisma.openingBalance.findMany({ where: { fiscalYear: String(year) } });
    const opening: Record<string, number> = { AL_RAWA_BANK: 0, GLOBAL_FORUM_BANK: 0, CASH_IN_HAND: 0 };
    openingRows.forEach(o => { opening[o.account] = Number(o.amount); });

    const balancesRaw = await prisma.$queryRaw<[{ al_rawa: string; global_forum: string; cash: string }]>`
      SELECT
        COALESCE(SUM(CASE WHEN destination_account = 'AL_RAWA_BANK' THEN amount
                         WHEN source_account = 'AL_RAWA_BANK' THEN -amount ELSE 0 END), 0) AS al_rawa,
        COALESCE(SUM(CASE WHEN destination_account = 'GLOBAL_FORUM_BANK' THEN amount
                         WHEN source_account = 'GLOBAL_FORUM_BANK' THEN -amount ELSE 0 END), 0) AS global_forum,
        COALESCE(SUM(CASE WHEN destination_account = 'CASH_IN_HAND' THEN amount
                         WHEN source_account = 'CASH_IN_HAND' THEN -amount ELSE 0 END), 0) AS cash
      FROM transactions
      WHERE is_cancelled = false AND reversal_of_id IS NULL
        AND transaction_date >= ${start} AND transaction_date <= ${end}
    `;
    const b = balancesRaw[0];
    const closing = {
      AL_RAWA_BANK: Number(b.al_rawa) + opening.AL_RAWA_BANK,
      GLOBAL_FORUM_BANK: Number(b.global_forum) + opening.GLOBAL_FORUM_BANK,
      CASH_IN_HAND: Number(b.cash) + opening.CASH_IN_HAND,
    };
    const totalAssets = closing.AL_RAWA_BANK + closing.GLOBAL_FORUM_BANK + closing.CASH_IN_HAND;
    const totalTransfers = transfers.reduce((s: number, t: any) => s + Number(t.amount), 0);

    res.json({
      fiscalYear: year,
      period: { start, end },
      income: headwise(income),
      expense: headwise(expense),
      totalIncome,
      totalExpense,
      netSurplus,
      opening,
      closing,
      totalAssets,
      totalTransfers,
      transferCount: transfers.length,
      transactionCount: tx.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

// ── Period Close ──

export const getPeriodCloses = async (_req: Request, res: Response) => {
  try {
    const periods = await prisma.periodClose.findMany({ orderBy: { fiscalYear: 'desc' } });
    res.json(periods);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const closePeriod = async (req: AuthRequest, res: Response) => {
  try {
    const { fiscalYear, notes } = req.body;
    if (!fiscalYear || typeof fiscalYear !== 'number') {
      return res.status(400).json({ error: 'fiscalYear is required and must be a number' });
    }
    const existing = await prisma.periodClose.findUnique({ where: { fiscalYear } });
    if (existing) return res.status(409).json({ error: `Fiscal year ${fiscalYear} is already closed` });

    const period = await prisma.periodClose.create({
      data: {
        fiscalYear,
        closedBy: req.session?.user?.id || "system",
        notes: notes || null,
      },
    });

    await logAudit({
      userId: req.session?.user?.id || "unknown",
      action: "PERIOD_CLOSE",
      entityType: "PeriodClose",
      entityId: String(fiscalYear),
      details: `Fiscal year ${fiscalYear} closed`,
    });

    res.status(201).json(period);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const reopenPeriod = async (req: AuthRequest, res: Response) => {
  try {
    const fiscalYear = Number(req.params.fiscalYear);
    if (isNaN(fiscalYear)) return res.status(400).json({ error: 'Invalid fiscal year' });

    const period = await prisma.periodClose.findUnique({ where: { fiscalYear } });
    if (!period) return res.status(404).json({ error: `Fiscal year ${fiscalYear} is not closed` });

    await prisma.periodClose.delete({ where: { id: period.id } });

    await logAudit({
      userId: req.session?.user?.id || "unknown",
      action: "PERIOD_REOPEN",
      entityType: "PeriodClose",
      entityId: String(fiscalYear),
      details: `Fiscal year ${fiscalYear} reopened`,
    });

    res.json({ message: `Fiscal year ${fiscalYear} reopened` });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

// ── Reconciliation ──

export const getReconciliations = async (req: Request, res: Response) => {
  try {
    const account = req.query.account as string | undefined;
    const where = account ? { account } : {};
    const records = await prisma.reconciliation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const createReconciliation = async (req: AuthRequest, res: Response) => {
  try {
    const { account, statementDate, closingBalance, notes } = req.body;
    if (!account || !statementDate || closingBalance === undefined) {
      return res.status(400).json({ error: 'account, statementDate, and closingBalance are required' });
    }

    const statementEnd = new Date(statementDate);
    statementEnd.setHours(23, 59, 59, 999);

    const openingRow = await prisma.openingBalance.findUnique({
      where: { fiscalYear_account: { fiscalYear: String(getFiscalYearForDate(statementEnd)), account } },
    });
    const openingAmount = openingRow ? Number(openingRow.amount) : 0;

    const raw = await prisma.$queryRaw<[{ net: string }]>`
      SELECT COALESCE(SUM(
        CASE WHEN destination_account = ${account} THEN amount
             WHEN source_account = ${account} THEN -amount ELSE 0 END
      ), 0) AS net
      FROM transactions
      WHERE is_cancelled = false AND reversal_of_id IS NULL
        AND transaction_date <= ${statementEnd}
    `;
    const systemBalance = openingAmount + Number(raw[0].net);

    const difference = Number(closingBalance) - systemBalance;
    const reconciled = Math.abs(difference) < 0.01;

    const record = await prisma.reconciliation.create({
      data: {
        account,
        statementDate: statementEnd,
        closingBalance,
        systemBalance,
        difference,
        status: reconciled ? 'reconciled' : 'difference',
        notes: notes || null,
        createdBy: req.session?.user?.id || "system",
      },
    });

    await logAudit({
      userId: req.session?.user?.id || "unknown",
      action: "RECONCILIATION_CREATE",
      entityType: "Reconciliation",
      entityId: record.id,
      details: `Reconciliation for ${account}: statement=${closingBalance}, system=${systemBalance}, diff=${difference}`,
    });

    res.status(201).json(record);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const getReconciliationDetail = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const rec = await prisma.reconciliation.findUnique({ where: { id } });
    if (!rec) return res.status(404).json({ error: "Not found" });

    const statementEnd = rec.statementDate;
    const openingRow = await prisma.openingBalance.findUnique({
      where: { fiscalYear_account: { fiscalYear: String(getFiscalYearForDate(statementEnd)), account: rec.account } },
    });
    const openingAmount = openingRow ? Number(openingRow.amount) : 0;

    const transactions = await prisma.$queryRaw<Array<{
      id: string; transaction_date: Date; transaction_type: string; source_account: string | null;
      destination_account: string | null; amount: string; description: string | null;
      category: string | null; student_id: string | null; class_name: string | null;
    }>>`
      SELECT id, transaction_date, transaction_type, source_account, destination_account,
             amount, description, category, student_id, class_name
      FROM transactions
      WHERE is_cancelled = false AND reversal_of_id IS NULL
        AND transaction_date <= ${statementEnd}
        AND (destination_account = ${rec.account} OR source_account = ${rec.account})
      ORDER BY transaction_date ASC
    `;

    res.json({ reconciliation: rec, openingBalance: openingAmount, transactions });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};
