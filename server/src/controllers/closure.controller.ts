import type { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { handleControllerError } from "../lib/errors.js";
import { validate, closePeriodSchema, createReconciliationSchema } from "../lib/validate.js";
import { logAudit } from "../lib/audit.js";
import { getFiscalYearForDate } from "../lib/fiscal-year.js";
import { param } from "../lib/param.js";

export const getPeriodCloses = async (_req: Request, res: Response) => {
  try {
    const periods = await prisma.periodClose.findMany({ orderBy: { fiscalYear: 'desc' } });
    res.json(periods);
  } catch (error: any) {
    handleControllerError(res, error, _req.path);
  }
};

export const closePeriod = async (req: AuthRequest, res: Response) => {
  try {
    const v = validate(closePeriodSchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { fiscalYear, notes } = v.data;
    const existing = await prisma.periodClose.findUnique({ where: { fiscalYear } });
    if (existing) return res.status(409).json({ error: `Fiscal year ${fiscalYear} is already closed` });

    const period = await prisma.periodClose.create({
      data: {
        fiscalYear,
        closedBy: req.user?.id || "system",
        notes: notes || null,
      },
    });

    await logAudit({
      userId: req.user?.id || "unknown",
      action: "PERIOD_CLOSE",
      entityType: "PeriodClose",
      entityId: String(fiscalYear),
      details: `Fiscal year ${fiscalYear} closed`,
    });

    res.status(201).json(period);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
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
      userId: req.user?.id || "unknown",
      action: "PERIOD_REOPEN",
      entityType: "PeriodClose",
      entityId: String(fiscalYear),
      details: `Fiscal year ${fiscalYear} reopened`,
    });

    res.json({ message: `Fiscal year ${fiscalYear} reopened` });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const getReconciliations = async (req: Request, res: Response) => {
  try {
    const account = req.query.account as string | undefined;
    const pageStr = req.query.page as string | undefined;
    const limitStr = req.query.limit as string | undefined;
    const where = account ? { account } : {};
    const page = pageStr ? Math.max(1, parseInt(pageStr, 10) || 1) : undefined;
    const limit = page ? Math.min(200, Math.max(1, parseInt(limitStr || '50', 10) || 50)) : undefined;
    if (page) {
      const [records, total] = await Promise.all([
        prisma.reconciliation.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit!,
          take: limit!,
        }),
        prisma.reconciliation.count({ where }),
      ]);
      return res.json({ data: records, total, page, totalPages: Math.ceil(total / limit!) });
    }
    const records = await prisma.reconciliation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    res.json(records);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const createReconciliation = async (req: AuthRequest, res: Response) => {
  try {
    const v = validate(createReconciliationSchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { account, statementDate, closingBalance, notes } = v.data;

    const statementEnd = new Date(statementDate);
    statementEnd.setHours(23, 59, 59, 999);

    const openingRow = await prisma.openingBalance.findUnique({
      where: { fiscalYear_account: { fiscalYear: getFiscalYearForDate(statementEnd), account } },
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
        createdBy: req.user?.id || "system",
      },
    });

    await logAudit({
      userId: req.user?.id || "unknown",
      action: "RECONCILIATION_CREATE",
      entityType: "Reconciliation",
      entityId: record.id,
      details: `Reconciliation for ${account}: statement=${closingBalance}, system=${systemBalance}, diff=${difference}`,
    });

    res.status(201).json(record);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const getReconciliationDetail = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const rec = await prisma.reconciliation.findUnique({ where: { id } });
    if (!rec) return res.status(404).json({ error: "Not found" });

    const statementEnd = rec.statementDate;
    const openingRow = await prisma.openingBalance.findUnique({
      where: { fiscalYear_account: { fiscalYear: getFiscalYearForDate(statementEnd), account: rec.account } },
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
    handleControllerError(res, error, req.path);
  }
};