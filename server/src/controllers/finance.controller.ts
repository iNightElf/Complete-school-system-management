import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { classifyTransaction } from "../lib/finance-rules.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const prisma = new PrismaClient();

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
        affectsIncomeLedger,
        affectsExpenseLedger,
        referenceId: referenceId || null,
        createdBy: req.user?.userId || "system",
      },
    });

    res.status(201).json(transaction);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { transactionDate: "desc" },
    });
    res.json(transactions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
