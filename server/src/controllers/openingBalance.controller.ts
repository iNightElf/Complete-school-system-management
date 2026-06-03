import type { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { handleControllerError } from "../lib/errors.js";
import { validate, setOpeningBalancesSchema } from "../lib/validate.js";

export const getOpeningBalances = async (req: Request, res: Response) => {
  try {
    const { year } = req.query;
    const fiscalYear = year ? Number(year) : new Date().getFullYear();
    const rows = await prisma.openingBalance.findMany({ where: { fiscalYear } });
    const result: Record<string, number> = { AL_RAWA_BANK: 0, GLOBAL_FORUM_BANK: 0, CASH_IN_HAND: 0 };
    rows.forEach(r => { result[r.account] = Number(r.amount); });
    res.json(result);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const setOpeningBalances = async (req: AuthRequest, res: Response) => {
  try {
    const v = validate(setOpeningBalancesSchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { year, balances } = v.data;
    const fiscalYear = year ? Number(year) : new Date().getFullYear();
    const userId = req.user?.id || 'system';
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
    handleControllerError(res, error, req.path);
  }
};

export const getOpeningBalanceHistory = async (req: Request, res: Response) => {
  try {
    const { year, account } = req.query;
    const where: any = {};
    if (year) where.fiscalYear = Number(year);
    if (account) where.account = String(account);
    const history = await prisma.openingBalanceHistory.findMany({
      where,
      orderBy: { changedAt: 'desc' },
      take: 100,
    });
    res.json(history);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const revertOpeningBalance = async (req: AuthRequest, res: Response) => {
  try {
    const historyId = req.params.id as string;
    const entry = await prisma.openingBalanceHistory.findUnique({ where: { id: historyId } });
    if (!entry) return res.status(404).json({ error: 'History entry not found' });

    const userId = req.user?.id || 'system';
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
    handleControllerError(res, error, req.path);
  }
};