import { describe, it, expect } from "vitest";
import { classifyTransaction, INTERNAL_ACCOUNTS } from "../src/lib/finance-rules.js";

describe("classifyTransaction", () => {
  it("returns INCOME for external source to internal destination", () => {
    const r = classifyTransaction(undefined, "AL_RAWA_BANK");
    expect(r.transactionType).toBe("INCOME");
    expect(r.affectsIncomeLedger).toBe(true);
    expect(r.affectsExpenseLedger).toBe(false);
  });

  it("returns EXPENSE for internal source to external destination", () => {
    const r = classifyTransaction("CASH_IN_HAND", undefined);
    expect(r.transactionType).toBe("EXPENSE");
    expect(r.affectsIncomeLedger).toBe(false);
    expect(r.affectsExpenseLedger).toBe(true);
  });

  it("classifies AL_RAWA → GLOBAL_FORUM as EXPENSE", () => {
    const r = classifyTransaction("AL_RAWA_BANK", "GLOBAL_FORUM_BANK");
    expect(r.transactionType).toBe("EXPENSE");
    expect(r.affectsIncomeLedger).toBe(false);
    expect(r.affectsExpenseLedger).toBe(true);
  });

  it("classifies GLOBAL_FORUM → AL_RAWA as INCOME", () => {
    const r = classifyTransaction("GLOBAL_FORUM_BANK", "AL_RAWA_BANK");
    expect(r.transactionType).toBe("INCOME");
    expect(r.affectsIncomeLedger).toBe(true);
    expect(r.affectsExpenseLedger).toBe(false);
  });

  it("classifies AL_RAWA → CASH as INTERNAL_TRANSFER", () => {
    const r = classifyTransaction("AL_RAWA_BANK", "CASH_IN_HAND");
    expect(r.transactionType).toBe("INTERNAL_TRANSFER");
    expect(r.affectsIncomeLedger).toBe(false);
    expect(r.affectsExpenseLedger).toBe(false);
  });

  it("classifies both external as INTERNAL_TRANSFER", () => {
    const r = classifyTransaction("External", "External");
    expect(r.transactionType).toBe("INTERNAL_TRANSFER");
  });
});

describe("INTERNAL_ACCOUNTS", () => {
  it("contains exactly 3 accounts", () => {
    expect(INTERNAL_ACCOUNTS).toHaveLength(3);
    expect(INTERNAL_ACCOUNTS).toContain("AL_RAWA_BANK");
    expect(INTERNAL_ACCOUNTS).toContain("GLOBAL_FORUM_BANK");
    expect(INTERNAL_ACCOUNTS).toContain("CASH_IN_HAND");
  });
});
