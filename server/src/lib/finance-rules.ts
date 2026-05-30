export const INTERNAL_ACCOUNTS = ["AL_RAWA_BANK", "GLOBAL_FORUM_BANK", "CASH_IN_HAND"] as const;
export type AccountName = typeof INTERNAL_ACCOUNTS[number];

interface RuleResult {
  transactionType: "INCOME" | "EXPENSE" | "INTERNAL_TRANSFER";
  affectsIncomeLedger: boolean;
  affectsExpenseLedger: boolean;
}

function isInternal(acc: string | undefined): boolean {
  return !!acc && (INTERNAL_ACCOUNTS as readonly string[]).includes(acc);
}

export function classifyTransaction(
  source: string | undefined,
  destination: string | undefined
): RuleResult {
  const srcInternal = isInternal(source);
  const dstInternal = isInternal(destination);

  // Both internal — transfer between school accounts
  if (srcInternal && dstInternal) {
    // AL_RAWA → GLOBAL_FORUM = EXPENSE (money leaving school ops)
    if (source === "AL_RAWA_BANK" && destination === "GLOBAL_FORUM_BANK") {
      return { transactionType: "EXPENSE", affectsIncomeLedger: false, affectsExpenseLedger: true };
    }
    // GLOBAL_FORUM → AL_RAWA = INCOME (money entering school ops)
    if (source === "GLOBAL_FORUM_BANK" && destination === "AL_RAWA_BANK") {
      return { transactionType: "INCOME", affectsIncomeLedger: true, affectsExpenseLedger: false };
    }
    // AL_RAWA → CASH or CASH → AL_RAWA = pure transfer (no ledger effect)
    return { transactionType: "INTERNAL_TRANSFER", affectsIncomeLedger: false, affectsExpenseLedger: false };
  }

  // External source → internal destination = INCOME
  if (!srcInternal && dstInternal) {
    return { transactionType: "INCOME", affectsIncomeLedger: true, affectsExpenseLedger: false };
  }

  // Internal source → external destination = EXPENSE
  if (srcInternal && !dstInternal) {
    return { transactionType: "EXPENSE", affectsIncomeLedger: false, affectsExpenseLedger: true };
  }

  // Both external (rare) — treat as transfer
  return { transactionType: "INTERNAL_TRANSFER", affectsIncomeLedger: false, affectsExpenseLedger: false };
}
