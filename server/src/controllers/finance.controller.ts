import type { Request, Response } from "express";
import { classifyTransaction } from "../lib/finance-rules.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError } from "../lib/errors.js";

export const createTransaction = async (req: AuthRequest, res: Response) => {
  try {
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
    } = req.body;

    const { transactionType, affectsIncomeLedger, affectsExpenseLedger } =
      classifyTransaction(sourceAccount, destinationAccount);

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
    const transactions = await prisma.transaction.findMany();

    let alRawaBank = 0;
    let globalForumBank = 0;
    let cashInHand = 0;

    transactions.forEach((t) => {
      const amt = Number(t.amount);
      const src = t.sourceAccount;
      const dst = t.destinationAccount;

      // Money into account
      if (dst === "AL_RAWA_BANK") alRawaBank += amt;
      if (dst === "GLOBAL_FORUM_BANK") globalForumBank += amt;
      if (dst === "CASH_IN_HAND") cashInHand += amt;

      // Money out of account
      if (src === "AL_RAWA_BANK") alRawaBank -= amt;
      if (src === "GLOBAL_FORUM_BANK") globalForumBank -= amt;
      if (src === "CASH_IN_HAND") cashInHand -= amt;
    });

    res.json({
      AL_RAWA_BANK: alRawaBank,
      GLOBAL_FORUM_BANK: globalForumBank,
      CASH_IN_HAND: cashInHand,
    });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { transactionDate: "desc" },
      include: { student: { select: { id: true, name: true, class: true, roll: true } } },
    });
    res.json(transactions);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const cancelTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const { reason } = req.body;

    const tx = await prisma.transaction.findUnique({ where: { id } });
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    if (tx.isCancelled) return res.status(400).json({ error: "Transaction already cancelled" });

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledBy: req.session?.user?.id || "system",
        cancelReason: reason || null,
      },
    });

    res.json(updated);
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
      where: { transactionType: 'INCOME', affectsIncomeLedger: true },
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
