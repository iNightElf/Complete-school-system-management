import { describe, it, expect } from "vitest";
import { classifyTransaction, INTERNAL_ACCOUNTS } from "../src/lib/finance-rules.js";

describe("INTERNAL_ACCOUNTS", () => {
  it("contains exactly 3 accounts", () => {
    expect(INTERNAL_ACCOUNTS).toHaveLength(3);
    expect(INTERNAL_ACCOUNTS).toContain("AL_RAWA_BANK");
    expect(INTERNAL_ACCOUNTS).toContain("GLOBAL_FORUM_BANK");
    expect(INTERNAL_ACCOUNTS).toContain("CASH_IN_HAND");
  });

  it("is a const array (as const preserves literal types)", () => {
    expect(Array.isArray(INTERNAL_ACCOUNTS)).toBe(true);
  });
});

describe("classifyTransaction", () => {
  describe("external → internal = INCOME", () => {
    it("undefined source to AL_RAWA_BANK", () => {
      const r = classifyTransaction(undefined, "AL_RAWA_BANK");
      expect(r).toEqual({ transactionType: "INCOME", affectsIncomeLedger: true, affectsExpenseLedger: false });
    });

    it("null source to GLOBAL_FORUM_BANK", () => {
      const r = classifyTransaction(null as any, "GLOBAL_FORUM_BANK");
      expect(r.transactionType).toBe("INCOME");
    });

    it("empty string source to CASH_IN_HAND", () => {
      const r = classifyTransaction("", "CASH_IN_HAND");
      expect(r.transactionType).toBe("INCOME");
    });

    it("external name to internal destination", () => {
      const r = classifyTransaction("Parent Payment", "AL_RAWA_BANK");
      expect(r.transactionType).toBe("INCOME");
    });
  });

  describe("internal → external = EXPENSE", () => {
    it("CASH_IN_HAND to undefined destination", () => {
      const r = classifyTransaction("CASH_IN_HAND", undefined);
      expect(r).toEqual({ transactionType: "EXPENSE", affectsIncomeLedger: false, affectsExpenseLedger: true });
    });

    it("AL_RAWA_BANK to null destination", () => {
      const r = classifyTransaction("AL_RAWA_BANK", null as any);
      expect(r.transactionType).toBe("EXPENSE");
    });

    it("GLOBAL_FORUM_BANK to external name", () => {
      const r = classifyTransaction("GLOBAL_FORUM_BANK", "Electricity Bill");
      expect(r.transactionType).toBe("EXPENSE");
    });
  });

  describe("internal → internal transfers", () => {
    it("AL_RAWA → GLOBAL_FORUM = EXPENSE (money leaving school ops)", () => {
      const r = classifyTransaction("AL_RAWA_BANK", "GLOBAL_FORUM_BANK");
      expect(r).toEqual({ transactionType: "EXPENSE", affectsIncomeLedger: false, affectsExpenseLedger: true });
    });

    it("GLOBAL_FORUM → AL_RAWA = INCOME (money entering school ops)", () => {
      const r = classifyTransaction("GLOBAL_FORUM_BANK", "AL_RAWA_BANK");
      expect(r).toEqual({ transactionType: "INCOME", affectsIncomeLedger: true, affectsExpenseLedger: false });
    });

    it("AL_RAWA → CASH_IN_HAND = INTERNAL_TRANSFER", () => {
      const r = classifyTransaction("AL_RAWA_BANK", "CASH_IN_HAND");
      expect(r).toEqual({ transactionType: "INTERNAL_TRANSFER", affectsIncomeLedger: false, affectsExpenseLedger: false });
    });

    it("CASH_IN_HAND → AL_RAWA = INTERNAL_TRANSFER", () => {
      const r = classifyTransaction("CASH_IN_HAND", "AL_RAWA_BANK");
      expect(r.transactionType).toBe("INTERNAL_TRANSFER");
    });

    it("CASH_IN_HAND → GLOBAL_FORUM = INTERNAL_TRANSFER", () => {
      const r = classifyTransaction("CASH_IN_HAND", "GLOBAL_FORUM_BANK");
      expect(r.transactionType).toBe("INTERNAL_TRANSFER");
    });

    it("GLOBAL_FORUM → CASH_IN_HAND = INTERNAL_TRANSFER", () => {
      const r = classifyTransaction("GLOBAL_FORUM_BANK", "CASH_IN_HAND");
      expect(r.transactionType).toBe("INTERNAL_TRANSFER");
    });
  });

  describe("both external = INTERNAL_TRANSFER", () => {
    it("both undefined", () => {
      const r = classifyTransaction(undefined, undefined);
      expect(r).toEqual({ transactionType: "INTERNAL_TRANSFER", affectsIncomeLedger: false, affectsExpenseLedger: false });
    });

    it("both null", () => {
      const r = classifyTransaction(null as any, null as any);
      expect(r.transactionType).toBe("INTERNAL_TRANSFER");
    });

    it("both external names", () => {
      const r = classifyTransaction("External A", "External B");
      expect(r.transactionType).toBe("INTERNAL_TRANSFER");
    });
  });
});
