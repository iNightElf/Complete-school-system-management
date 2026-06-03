import type { Request, Response } from "express";
import { classifyTransaction } from "../lib/finance-rules.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { handleControllerError } from "../lib/errors.js";
import { validate, createTransactionSchema } from "../lib/validate.js";
import { logAudit } from "../lib/audit.js";
import { getFiscalYearForDate, getFiscalYearRange } from "../lib/fiscal-year.js";

export const ACCOUNT_BALANCES_SQL = `
  SELECT
    COALESCE(SUM(CASE WHEN destination_account = 'AL_RAWA_BANK' THEN amount
                     WHEN source_account = 'AL_RAWA_BANK' THEN -amount ELSE 0 END), 0) AS al_rawa,
    COALESCE(SUM(CASE WHEN destination_account = 'GLOBAL_FORUM_BANK' THEN amount
                     WHEN source_account = 'GLOBAL_FORUM_BANK' THEN -amount ELSE 0 END), 0) AS global_forum,
    COALESCE(SUM(CASE WHEN destination_account = 'CASH_IN_HAND' THEN amount
                     WHEN source_account = 'CASH_IN_HAND' THEN -amount ELSE 0 END), 0) AS cash
  FROM transactions
  WHERE is_cancelled = false AND reversal_of_id IS NULL
    AND transaction_date >= $1::timestamptz AND transaction_date <= $2::timestamptz
`;

export function dateToMonthStr(d: Date | null): string | null {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

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

    const allocations = validation.data.allocations || [];

    if (allocations.length > 0) {
      const allocFsIds = [...new Set(allocations.map(a => a.feeScheduleId))];
      const feeSchedules = await prisma.feeSchedule.findMany({ where: { id: { in: allocFsIds } } });
      const fsMap = new Map(feeSchedules.map(f => [f.id, f]));

      let assignedMap = new Map<string, boolean>();
      if (studentId) {
        const assigned = await prisma.studentFeeAssignment.findMany({
          where: { studentId, feeScheduleId: { in: allocFsIds }, active: true },
          select: { feeScheduleId: true },
        });
        assigned.forEach(a => assignedMap.set(a.feeScheduleId, true));
      }

      let dupSet = new Set<string>();
      if (studentId) {
        const periods = [...new Set(allocations.map(a => a.period).filter(Boolean))] as string[];
        const existingAllocs = await prisma.paymentAllocation.findMany({
          where: { studentId, feeScheduleId: { in: allocFsIds }, period: { in: periods } },
          include: { transaction: { select: { isCancelled: true, reversalOfId: true } } },
        });
        existingAllocs
          .filter(a => !a.transaction.isCancelled && !a.transaction.reversalOfId)
          .forEach(a => dupSet.add(`${a.feeScheduleId}|${a.period}`));
      }

      for (const alloc of allocations) {
        const fs = fsMap.get(alloc.feeScheduleId);
        if (!fs) return res.status(400).json({ error: `Fee schedule "${alloc.feeScheduleId}" not found` });
        if (studentId && fs.applicability === 'ASSIGNED_ONLY' && !assignedMap.has(fs.id)) {
          return res.status(400).json({ error: `Fee "${fs.category}" is assigned-only and this student has no active assignment` });
        }
        if (studentId && dupSet.has(`${alloc.feeScheduleId}|${alloc.period}`)) {
          return res.status(409).json({ error: `${fs.category} for ${alloc.period} is already recorded for this student` });
        }
      }
    } else if (studentId && feeMonth && category) {
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

    const hasMultipleAllocations = allocations.length > 0;

    const [transaction] = await prisma.$transaction(async (tx) => {
      const tf = transactionType === 'INCOME' || transactionType === 'EXPENSE' ? transactionType : null;
      let receiptNum: { fiscalYear: number; sequence: number } | null = null;
      if (tf) {
        const fy = getFiscalYearForDate(new Date(date));
        const counter = await tx.receiptCounter.upsert({
          where: { fiscalYear_receiptType: { fiscalYear: fy, receiptType: tf } },
          update: { nextSequence: { increment: 1 } },
          create: { fiscalYear: fy, receiptType: tf, nextSequence: 2 },
        });
        receiptNum = { fiscalYear: fy, sequence: counter.nextSequence - 1 };
      }

      const t = await tx.transaction.create({
        data: {
          transactionDate: new Date(date),
          amount: finalAmount,
          transactionType,
          sourceAccount: sourceAccount || null,
          destinationAccount: destinationAccount || null,
          category: hasMultipleAllocations ? "STUDENT_FEES" : (category || null),
          description: note || null,
          studentId: studentId || null,
          className: className || null,
          affectsIncomeLedger,
          affectsExpenseLedger,
          referenceId: referenceId || null,
          feeMonth: feeMonth || null,
          fiscalYear: receiptNum?.fiscalYear ?? null,
          receiptSequence: receiptNum?.sequence ?? null,
          createdBy: req.user?.id || "system",
        },
      });

      if (studentId && hasMultipleAllocations) {
        for (const alloc of allocations) {
          await tx.paymentAllocation.create({
            data: {
              transactionId: t.id,
              studentId,
              feeScheduleId: alloc.feeScheduleId,
              period: alloc.period,
              amount: alloc.amount,
            },
          });
        }
      } else if (studentId) {
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

    logAudit({ userId: req.user?.id, action: "CREATE", entityType: "Transaction", entityId: transaction.id, details: JSON.stringify({ amount: finalAmount, transactionType, category, studentId }) });

    res.status(201).json(transaction);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const getBalances = async (req: Request, res: Response) => {
  try {
    const { year } = req.query;
    const fiscalYear = year ? Number(year) : new Date().getFullYear();
    const { start, end } = getFiscalYearRange(fiscalYear);

    const rows = await prisma.$queryRawUnsafe<[{ al_rawa: string | null; global_forum: string | null; cash: string | null }]>(ACCOUNT_BALANCES_SQL, start, end);
    const r = rows[0];

    const openingRows = await prisma.openingBalance.findMany({ where: { fiscalYear } });
    const opening: Record<string, number> = { AL_RAWA_BANK: 0, GLOBAL_FORUM_BANK: 0, CASH_IN_HAND: 0 };
    openingRows.forEach(o => { opening[o.account] = Number(o.amount); });

    res.json({
      AL_RAWA_BANK: Number(r.al_rawa) + opening.AL_RAWA_BANK,
      GLOBAL_FORUM_BANK: Number(r.global_forum) + opening.GLOBAL_FORUM_BANK,
      CASH_IN_HAND: Number(r.cash) + opening.CASH_IN_HAND,
      opening,
    });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const getLedger = async (req: Request, res: Response) => {
  try {
    const { account, dateFrom, dateTo, page: pageStr, limit: limitStr, year: yearStr } = req.query;
    if (account !== 'AL_RAWA_BANK' && account !== 'CASH_IN_HAND') {
      return res.status(400).json({ error: "account must be AL_RAWA_BANK or CASH_IN_HAND" });
    }
    const fiscalYear = yearStr ? Number(yearStr) : new Date().getFullYear();
    const { start, end } = getFiscalYearRange(fiscalYear);
    const dateFromStr = dateFrom ? String(dateFrom) : start.toISOString().split('T')[0];
    const dateToStr = dateTo ? String(dateTo) : end.toISOString().split('T')[0];

    const page = Math.max(1, parseInt(String(pageStr || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(limitStr || '25'), 10) || 25));
    const offset = (page - 1) * limit;

    const dateFromDate = new Date(dateFromStr);
    const dateToDate = new Date(dateToStr + 'T23:59:59Z');

    const where: any = {
      transactionDate: { gte: dateFromDate, lte: dateToDate },
      OR: [
        { destinationAccount: account },
        { sourceAccount: account },
      ],
    };

    const openingRow = await prisma.openingBalance.findFirst({
      where: { fiscalYear, account: account as string },
    });
    const fiscalOpening = openingRow ? Number(openingRow.amount) : 0;

    // If a custom dateFrom is set, compute the actual opening balance at that date
    // by summing all transactions from fiscal year start up to (but not including) dateFrom
    let openingBalance = fiscalOpening;
    if (dateFrom) {
      const prior = await prisma.$queryRawUnsafe<[{ total: string | null }]>(`
        SELECT COALESCE(SUM(
          CASE WHEN destination_account = $1::text THEN amount
               WHEN source_account = $1::text THEN -amount ELSE 0 END
        ), 0) AS total
        FROM transactions
        WHERE transaction_date >= $2::timestamptz AND transaction_date < $3::timestamptz
          AND (destination_account = $1::text OR source_account = $1::text)
      `, account, start, dateFromDate);
      openingBalance = fiscalOpening + Number(prior[0]?.total || 0);
    }

    const [total, raw, totals] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
        WITH ledger AS (
          SELECT id, transaction_date, amount, transaction_type, source_account,
                 destination_account, category, description, student_id, class_name,
                 fee_month, is_cancelled, receipt_sequence, fiscal_year, created_at,
                 reversal_of_id,
            $1::numeric + COALESCE(SUM(
              CASE WHEN destination_account = $2::text THEN amount
                   WHEN source_account = $2::text THEN -amount ELSE 0 END
            ) OVER (ORDER BY transaction_date ASC, created_at ASC), 0) AS running_balance
          FROM transactions
          WHERE transaction_date >= $3::timestamptz AND transaction_date <= $4::timestamptz
            AND (destination_account = $2::text OR source_account = $2::text)
        )
        SELECT * FROM ledger
        ORDER BY transaction_date ASC, created_at ASC
        LIMIT $5 OFFSET $6
      `, openingBalance, account, dateFromDate, dateToDate, limit, offset),
      prisma.$queryRawUnsafe<[{ dr: string | null; cr: string | null }]>(`
        SELECT
          COALESCE(SUM(CASE WHEN destination_account = $1::text THEN amount ELSE 0 END), 0) AS dr,
          COALESCE(SUM(CASE WHEN source_account = $1::text THEN amount ELSE 0 END), 0) AS cr
        FROM transactions
        WHERE transaction_date >= $2::timestamptz AND transaction_date <= $3::timestamptz
          AND (destination_account = $1::text OR source_account = $1::text)
          AND is_cancelled = false
          AND reversal_of_id IS NULL
      `, account, dateFromDate, dateToDate),
    ]);

    // Batch-fetch student names for rows on this page
    const studentIds = [...new Set(raw.filter(r => r.student_id).map(r => r.student_id as string))];
    const studentMap = new Map<string, { name: string; class: string }>();
    if (studentIds.length > 0) {
      const students = await prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, name: true, class: true },
      });
      students.forEach(s => studentMap.set(s.id, { name: s.name, class: s.class || '' }));
    }

    const totalDebits = Number(totals[0]?.dr || 0);
    const totalCredits = Number(totals[0]?.cr || 0);
    const entries = raw.map((t: any) => {
      const isDebit = t.destination_account === account;
      const debitAmt = isDebit ? Number(t.amount) : 0;
      const creditAmt = !isDebit ? Number(t.amount) : 0;
      const student = t.student_id ? studentMap.get(t.student_id) : undefined;
      return {
        id: t.id,
        date: t.transaction_date,
        transactionType: t.transaction_type,
        isCancelled: t.is_cancelled,
        reversalOfId: t.reversal_of_id || null,
        receiptSequence: t.receipt_sequence,
        fiscalYear: t.fiscal_year,
        description: [
          t.category || '',
          student ? `${student.name}${student.class ? ` (${student.class})` : ''}` : '',
          t.description || '',
        ].filter(Boolean).join(' — ') || `${(t.source_account || 'External').replace(/_/g, ' ')} → ${(t.destination_account || 'External').replace(/_/g, ' ')}`,
        debit: debitAmt || null,
        credit: creditAmt || null,
        runningBalance: Number(t.running_balance),
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const closingBalance = openingBalance + totalDebits - totalCredits;

    res.json({
      data: entries,
      openingBalance,
      closingBalance,
      totalDebits,
      totalCredits,
      total,
      page,
      totalPages,
    });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, type, page: pageStr, limit: limitStr } = req.query;
    const where: any = {};
    if (dateFrom || dateTo) {
      where.transactionDate = {};
      if (dateFrom) where.transactionDate.gte = new Date(String(dateFrom));
      if (dateTo) where.transactionDate.lte = new Date(String(dateTo) + 'T23:59:59Z');
    }
    if (type && type !== 'all') where.transactionType = String(type);
    const page = Math.max(1, parseInt(String(pageStr || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(limitStr || '50'), 10) || 50));
    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: { student: { select: { id: true, name: true, class: true, studentId: true } } },
      }),
      prisma.transaction.count({ where }),
    ]);
    res.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const cancelTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "Reason is required to cancel a transaction" });

    const tx = await prisma.transaction.findUnique({ where: { id }, include: { student: { select: { id: true, name: true, class: true, studentId: true } } } });
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    if (tx.isCancelled) return res.status(400).json({ error: "Transaction already cancelled" });

    const fiscalYear = getFiscalYearForDate(new Date(tx.transactionDate));
    const closedPeriod = await prisma.periodClose.findFirst({
      where: { fiscalYear },
    });
    if (closedPeriod) {
      return res.status(403).json({ error: `Fiscal year ${fiscalYear} is closed. Transactions in this period cannot be cancelled.` });
    }

    const userId = req.user?.id || "system";
    const studentName = (tx as any).student?.name || null;
    const studentClass = (tx as any).className || (tx as any).student?.class || null;

    const { transactionType, affectsIncomeLedger, affectsExpenseLedger } =
      classifyTransaction(tx.destinationAccount || undefined, tx.sourceAccount || undefined);

    const [cancelled, reversal] = await prisma.$transaction([
      prisma.transaction.update({
        where: { id },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          cancelledBy: userId,
          cancelReason: reason || null,
        },
      }),
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
    handleControllerError(res, error, req.path);
  }
};

function monthsInRange(from: string, to: string): string[] {
  const months: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [y2, m2] = to.split('-').map(Number);
  while (y < y2 || (y === y2 && m <= m2)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

export const getFeeStatus = async (req: Request, res: Response) => {
  try {
    const { studentId, feeMonth, feeMonthTo, classId } = req.query;
    if (!studentId || !feeMonth) return res.status(400).json({ error: "studentId and feeMonth are required" });

    const student = await prisma.student.findUnique({
      where: { id: String(studentId) },
      select: { classId: true, class: true },
    });
    if (!student) return res.status(404).json({ error: "Student not found" });

    const feeSchedules = await prisma.feeSchedule.findMany({
      where: {
        OR: [{ classId: student.classId }, { classId: null }],
      },
    });

    const feeAssignments = await prisma.studentFeeAssignment.findMany({
      where: { studentId: String(studentId), active: true },
    });
    const assignedIds = new Set(feeAssignments.map(a => a.feeScheduleId));

    const monthlyIds = feeSchedules.filter(f => f.frequency === 'MONTHLY').map(f => f.id);
    const onetimeIds = feeSchedules.filter(f => f.frequency !== 'MONTHLY').map(f => f.id);

    const period = String(feeMonth);
    const year = period.split('-')[0];

    const range = feeMonthTo && String(feeMonthTo) > period
      ? monthsInRange(period, String(feeMonthTo))
      : [period];

    const allocations = await prisma.paymentAllocation.findMany({
      where: {
        studentId: String(studentId),
        feeScheduleId: { in: monthlyIds },
        period: { in: range },
      },
      include: { transaction: { select: { isCancelled: true, reversalOfId: true } } },
    });

    const onetimePaid = onetimeIds.length > 0 ? await prisma.paymentAllocation.findMany({
      where: {
        studentId: String(studentId),
        feeScheduleId: { in: onetimeIds },
      },
      include: { transaction: { select: { isCancelled: true, reversalOfId: true } } },
    }) : [];

    const paidMap = new Map<string, Set<string>>();
    for (const a of allocations) {
      if (a.transaction.isCancelled || a.transaction.reversalOfId) continue;
      const fsId = a.feeScheduleId;
      const prd = a.period;
      if (!fsId || !prd) continue;
      if (!paidMap.has(fsId)) paidMap.set(fsId, new Set());
      paidMap.get(fsId)!.add(prd);
    }

    const onetimePaidSet = new Set(
      onetimePaid.filter(a => !a.transaction.isCancelled && !a.transaction.reversalOfId && a.feeScheduleId).map(a => a.feeScheduleId as string)
    );

    const activeWaivers = await prisma.feeWaiver.findMany({
      where: { active: true, studentId: String(studentId) },
    });
    const waiverMap = new Map(activeWaivers.map(w => [w.feeScheduleId, w]));

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const result = feeSchedules
      .filter(fs => {
        if (fs.applicability === 'ASSIGNED_ONLY') return assignedIds.has(fs.id);
        return true;
      })
      .map(fs => {
        const waiver = waiverMap.get(fs.id);
        let amount = Number(fs.amount);
        if (waiver && waiver.type === 'CUSTOM_AMOUNT') amount = Number(waiver.value);

        const isMonthly = fs.frequency === 'MONTHLY';
        let paidMonths: string[] = [];
        let unpaidMonths: string[] = [];
        if (isMonthly && range.length > 1) {
          const paid = paidMap.get(fs.id) || new Set();
          for (const m of range) {
            if (paid.has(m)) {
              paidMonths.push(m);
            } else {
              unpaidMonths.push(m);
            }
          }
        }

        return {
          feeScheduleId: fs.id,
          category: fs.category,
          frequency: fs.frequency,
          amount,
          paid: isMonthly ? unpaidMonths.length === 0 : onetimePaidSet.has(fs.id),
          months: isMonthly && range.length > 1 ? range.map(m => ({
            period: m,
            label: MONTH_NAMES[parseInt(m.split('-')[1]) - 1],
            paid: (paidMap.get(fs.id) || new Set()).has(m),
          })) : undefined,
          unpaidMonths: isMonthly && unpaidMonths.length > 0
            ? unpaidMonths.map(m => MONTH_NAMES[parseInt(m.split('-')[1]) - 1])
            : undefined,
        };
      });

    res.json(result);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};