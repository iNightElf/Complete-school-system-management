import type { Request, Response } from "express";
import { classifyTransaction } from "../lib/finance-rules.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError } from "../lib/errors.js";
import { validate, createTransactionSchema } from "../lib/validate.js";

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
    } = validation.data;

    const { transactionType, affectsIncomeLedger, affectsExpenseLedger } =
      classifyTransaction(sourceAccount, destinationAccount);

    const STUDENT_FEE_CATEGORIES = ['Tuition Fee', 'Hifz Tuition Fee', 'Admission Fee', 'Hifz Admission Fee', 'Books Fee', 'Copy Fee', 'Stationary Fee', 'Accessories Fee'];
    if (studentId && feeMonth && category && STUDENT_FEE_CATEGORIES.includes(category)) {
      const existing = await prisma.transaction.findFirst({
        where: { studentId, category, feeMonth, isCancelled: false },
      });
      if (existing) {
        return res.status(409).json({ error: `${category} for ${feeMonth} is already recorded for this student` });
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

    const transaction = await prisma.transaction.create({
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

    res.status(201).json(transaction);
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};

export const getBalances = async (req: Request, res: Response) => {
  try {
    const rows = await prisma.$queryRaw<[{ al_rawa: string | null; global_forum: string | null; cash: string | null }]>`
      SELECT
        COALESCE(SUM(CASE WHEN destination_account = 'AL_RAWA_BANK' THEN amount
                         WHEN source_account = 'AL_RAWA_BANK' THEN -amount ELSE 0 END), 0) AS al_rawa,
        COALESCE(SUM(CASE WHEN destination_account = 'GLOBAL_FORUM_BANK' THEN amount
                         WHEN source_account = 'GLOBAL_FORUM_BANK' THEN -amount ELSE 0 END), 0) AS global_forum,
        COALESCE(SUM(CASE WHEN destination_account = 'CASH_IN_HAND' THEN amount
                         WHEN source_account = 'CASH_IN_HAND' THEN -amount ELSE 0 END), 0) AS cash
      FROM transactions WHERE is_cancelled = false
    `;
    const r = rows[0];
    res.json({
      AL_RAWA_BANK: Number(r.al_rawa),
      GLOBAL_FORUM_BANK: Number(r.global_forum),
      CASH_IN_HAND: Number(r.cash),
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
    const historyId = req.params.id;
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
    const id = req.params.id;
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "Reason is required to cancel a transaction" });

    const tx = await prisma.transaction.findUnique({ where: { id }, include: { student: { select: { id: true, name: true, class: true, roll: true } } } });
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    if (tx.isCancelled) return res.status(400).json({ error: "Transaction already cancelled" });

    const userId = req.session?.user?.id || "system";
    const studentName = tx.student?.name || null;
    const studentClass = tx.className || tx.student?.class || null;

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

    res.json({ cancelled, reversal });
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};

// ── Fee Assignments (special fees: hifz, hifz_admission, transport) ──

const SPECIAL_FEE_TYPES = ['hifz_tuition', 'hifz_admission', 'transport'] as const;

export const getFeeAssignments = async (req: Request, res: Response) => {
  try {
    const { className } = req.query;
    let assignments = await prisma.feeAssignment.findMany({
      where: { active: true },
    });
    if (className) {
      const classStudents = await prisma.student.findMany({ where: { class: String(className) }, select: { id: true } });
      const ids = classStudents.map(s => s.id);
      assignments = assignments.filter(a => ids.includes(a.studentId));
    }
    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const toggleFeeAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, feeType, amount } = req.body;
    if (!studentId || !feeType) return res.status(400).json({ error: 'studentId and feeType required' });
    if (!SPECIAL_FEE_TYPES.includes(feeType as any)) return res.status(400).json({ error: 'Invalid feeType' });

    const existing = await prisma.feeAssignment.findUnique({ where: { studentId_feeType: { studentId, feeType } } });
    if (existing) {
      const updated = await prisma.feeAssignment.update({ where: { id: existing.id }, data: { active: !existing.active, amount: amount != null ? Number(amount) : existing.amount } });
      return res.json(updated);
    }
    const created = await prisma.feeAssignment.create({ data: { studentId, feeType, amount: Number(amount || 0) } });
    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};

export const updateFeeAssignmentAmount = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const updated = await prisma.feeAssignment.update({ where: { id }, data: { amount: Number(amount) } });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};

// ── Per-student fee categories (from transactions) ──
const RECURRING_CATEGORIES = ['Tuition Fee', 'Hifz Tuition Fee', 'Transport Fee'];
const ONETIME_CATEGORIES = ['Admission Fee', 'Hifz Admission Fee', 'Books Fee', 'Copy Fee', 'Stationary Fee'];
const GLOBAL_CATEGORIES = ['Accessories Fee'];
const SPECIAL_LABELS: Record<string, string> = { hifz_tuition: 'Hifz Fee', hifz_admission: 'Hifz Admission Fee', transport: 'Transport Fee' };

function getMonthRange(startYM: string, endYM: string): string[] {
  const months: string[] = [];
  let [y, m] = startYM.split('-').map(Number);
  const [ey, em] = endYM.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return months;
}

// ── Defaulter Report ──

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
    const allIncomeTx = await prisma.transaction.findMany({
      where: { transactionType: 'INCOME', affectsIncomeLedger: true, isCancelled: false },
      orderBy: { transactionDate: 'desc' },
    });

    const studentTx = allIncomeTx.filter(t => studentIds.includes(t.studentId || ''));
    const specialAssignments = await prisma.feeAssignment.findMany({
      where: { active: true, ...(studentIds.length ? { studentId: { in: studentIds } } : {}) },
    });

    // Build per-class fee lookup
    const classFeeMap: Record<string, Record<string, number>> = {};
    allIncomeTx.forEach(t => {
      if (t.className && (RECURRING_CATEGORIES.includes(t.category || '') || ONETIME_CATEGORIES.includes(t.category || '') || GLOBAL_CATEGORIES.includes(t.category || ''))) {
        if (!classFeeMap[t.className]) classFeeMap[t.className] = {};
        if (!classFeeMap[t.className][t.category!]) classFeeMap[t.className][t.category!] = Number(t.amount);
      }
    });

    // Global fee: last amount paid by ANY student
    const globalFeeAmounts: Record<string, number> = {};
    GLOBAL_CATEGORIES.forEach(cat => {
      const tx = allIncomeTx.find(t => t.category === cat);
      if (tx) globalFeeAmounts[cat] = Number(tx.amount);
    });

    // Default fee amounts per student (last paid)
    const getStudentDefault = (sid: string, cat: string): number | null => {
      const tx = studentTx.find(t => t.studentId === sid && t.category === cat);
      return tx ? Number(tx.amount) : null;
    };

    // Per-class default: last paid by any student in class
    const getClassDefault = (cls: string, cat: string): number | null => {
      return classFeeMap[cls]?.[cat] || null;
    };

    const result = students.map(student => {
      const fees: any[] = [];

      // ── Recurring fees (monthly) ──
      if (monthFrom && monthTo) {
        const months = getMonthRange(String(monthFrom), String(monthTo));
        RECURRING_CATEGORIES.forEach(cat => {
          if (feeCategory && feeCategory !== cat) return;
          const defaultAmt = getStudentDefault(student.id, cat) || getClassDefault(student.class, cat) || 0;
          if (defaultAmt <= 0) return;
          const paidMonths = new Set(
            studentTx
              .filter(t => t.studentId === student.id && t.category === cat)
              .map(t => {
                // Prefer explicit feeMonth, fall back to transaction date
                if (t.feeMonth) return t.feeMonth;
                const d = new Date(t.transactionDate);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              })
          );
          const monthDetail = months.map(m => ({ month: m, paid: paidMonths.has(m), amount: defaultAmt }));
          const unpaidCount = monthDetail.filter(m => !m.paid).length;
          fees.push({
            name: cat, type: 'recurring', amount: defaultAmt,
            totalDue: defaultAmt * unpaidCount,
            totalPaid: defaultAmt * (months.length - unpaidCount),
            months: monthDetail,
          });
        });

        // Special recurring fees
        SPECIAL_FEE_TYPES.forEach(ft => {
          if (feeCategory && feeCategory !== ft) return;
          const assignment = specialAssignments.find(a => a.studentId === student.id && a.feeType === ft);
          const defaultAmt = assignment ? Number(assignment.amount) : 0;
          if (!assignment) return;
          const label = SPECIAL_LABELS[ft];
          const paidMonths = new Set(
            studentTx
              .filter(t => t.studentId === student.id && t.category === label)
              .map(t => {
                if (t.feeMonth) return t.feeMonth;
                const d = new Date(t.transactionDate);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              })
          );
          const monthDetail = months.map(m => ({ month: m, paid: paidMonths.has(m), amount: defaultAmt }));
          const unpaidCount = monthDetail.filter(m => !m.paid).length;
          fees.push({
            name: label, type: 'special', amount: defaultAmt,
            totalDue: defaultAmt * unpaidCount,
            totalPaid: defaultAmt * (months.length - unpaidCount),
            months: monthDetail,
          });
        });
      }

      // ── One-time fees (yearly) ──
      if (year) {
        ONETIME_CATEGORIES.forEach(cat => {
          if (feeCategory && feeCategory !== cat) return;
          let defaultAmt = getStudentDefault(student.id, cat) || getClassDefault(student.class, cat) || 0;
          if (defaultAmt <= 0) return;
          const paid = studentTx.some(t => t.studentId === student.id && t.category === cat && new Date(t.transactionDate).getFullYear() === Number(year));
          fees.push({
            name: cat, type: 'onetime', amount: defaultAmt,
            totalDue: paid ? 0 : defaultAmt,
            totalPaid: paid ? defaultAmt : 0,
            paid,
            year: Number(year),
          });
        });

        // Global fees (Accessories Fee) — same for all students
        GLOBAL_CATEGORIES.forEach(cat => {
          if (feeCategory && feeCategory !== cat) return;
          const defaultAmt = globalFeeAmounts[cat] || 0;
          if (defaultAmt <= 0) return;
          const paid = studentTx.some(t => t.studentId === student.id && t.category === cat && new Date(t.transactionDate).getFullYear() === Number(year));
          fees.push({
            name: cat, type: 'global', amount: defaultAmt,
            totalDue: paid ? 0 : defaultAmt,
            totalPaid: paid ? defaultAmt : 0,
            paid,
            year: Number(year),
          });
        });
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
