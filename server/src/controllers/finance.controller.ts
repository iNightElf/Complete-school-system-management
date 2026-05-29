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
      directExpenseBeforeDeposit
    } = req.body;

    // Use the classification engine
    const { transactionType, affectsIncomeLedger, affectsExpenseLedger } = classifyTransaction(
      sourceAccount,
      destinationAccount
    );

    // Handle Emergency Expense before deposit if applicable
    let finalAmount = amount;
    let note = description;
    
    if (totalIncomeCollected && directExpenseBeforeDeposit) {
      finalAmount = totalIncomeCollected - directExpenseBeforeDeposit;
      note = `${description || ''} [Emergency Expense: ${directExpenseBeforeDeposit} deducted from ${totalIncomeCollected}]`.trim();
    }

    const transaction = await prisma.transaction.create({
      data: {
        transactionDate: new Date(date),
        amount: finalAmount,
        transactionType,
        sourceAccount,
        destinationAccount,
        category,
        description: note,
        affectsIncomeLedger,
        affectsExpenseLedger,
        referenceId,
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

    transactions.forEach(t => {
      const amt = Number(t.amount);
      
      // Basic accounting logic based on spec
      if (t.transactionType === "INCOME") {
        if (t.destinationAccount === "AL_RAWA_BANK") alRawaBank += amt;
      } else if (t.transactionType === "EXPENSE") {
        if (t.sourceAccount === "AL_RAWA_BANK") alRawaBank -= amt;
      } else if (t.transactionType === "INTERNAL_TRANSFER") {
        if (t.sourceAccount === "AL_RAWA_BANK") alRawaBank -= amt;
        if (t.destinationAccount === "AL_RAWA_BANK") alRawaBank += amt;
        
        if (t.sourceAccount === "GLOBAL_FORUM_BANK") globalForumBank -= amt;
        if (t.destinationAccount === "GLOBAL_FORUM_BANK") globalForumBank += amt;
        
        if (t.sourceAccount === "CASH_IN_HAND") cashInHand -= amt;
        if (t.destinationAccount === "CASH_IN_HAND") cashInHand += amt;
      }
    });

    res.json({
      AL_RAWA_BANK: alRawaBank,
      GLOBAL_FORUM_BANK: globalForumBank,
      CASH_IN_HAND: cashInHand
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { transactionDate: 'desc' }
    });
    res.json(transactions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
