export type AccountName =
  | "AL_RAWA_BANK"
  | "GLOBAL_FORUM_BANK"
  | "CASH_IN_HAND";

interface RuleResult {
  transactionType: string;
  affectsIncomeLedger: boolean;
  affectsExpenseLedger: boolean;
}

export function classifyTransaction(
  source: AccountName | string | undefined,
  destination: AccountName | string | undefined
): RuleResult {
  // GLOBAL_FORUM → AL_RAWA = INCOME
  if (
    source === "GLOBAL_FORUM_BANK" &&
    destination === "AL_RAWA_BANK"
  ) {
    return {
      transactionType: "INCOME",
      affectsIncomeLedger: true,
      affectsExpenseLedger: false,
    };
  }

  // AL_RAWA → GLOBAL_FORUM = EXPENSE
  if (
    source === "AL_RAWA_BANK" &&
    destination === "GLOBAL_FORUM_BANK"
  ) {
    return {
      transactionType: "EXPENSE",
      affectsIncomeLedger: false,
      affectsExpenseLedger: true,
    };
  }

  // AL_RAWA → CASH = INTERNAL TRANSFER
  if (
    source === "AL_RAWA_BANK" &&
    destination === "CASH_IN_HAND"
  ) {
    return {
      transactionType: "INTERNAL_TRANSFER",
      affectsIncomeLedger: false,
      affectsExpenseLedger: false,
    };
  }

  // DEFAULT INTERNAL TRANSFER
  return {
    transactionType: "INTERNAL_TRANSFER",
    affectsIncomeLedger: false,
    affectsExpenseLedger: false,
  };
}
