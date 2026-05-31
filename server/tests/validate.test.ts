import { describe, it, expect } from "vitest";
import { validate, createTransactionSchema } from "../src/lib/validate.js";

describe("createTransactionSchema", () => {
  const validTx = {
    date: "2026-01-15",
    amount: 1000,
    sourceAccount: "CASH_IN_HAND",
    destinationAccount: "AL_RAWA_BANK",
    category: "Tuition Fee",
  };

  it("accepts a valid income transaction", () => {
    const r = validate(createTransactionSchema, {
      date: "2026-01-15",
      amount: 500,
      destinationAccount: "AL_RAWA_BANK",
      category: "Tuition Fee",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a valid expense transaction", () => {
    const r = validate(createTransactionSchema, {
      date: "2026-01-15",
      amount: 200,
      sourceAccount: "CASH_IN_HAND",
      category: "Salary",
    });
    expect(r.success).toBe(true);
  });

  it("rejects missing date", () => {
    const r = validate(createTransactionSchema, { amount: 100 });
    expect(r.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const r = validate(createTransactionSchema, { date: "2026-01-15", amount: -100 });
    expect(r.success).toBe(false);
  });

  it("rejects zero amount", () => {
    const r = validate(createTransactionSchema, { date: "2026-01-15", amount: 0 });
    expect(r.success).toBe(false);
  });

  it("rejects same-account transfer", () => {
    const r = validate(createTransactionSchema, {
      date: "2026-01-15",
      amount: 100,
      sourceAccount: "AL_RAWA_BANK",
      destinationAccount: "AL_RAWA_BANK",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain("different");
  });

  it("rejects invalid account name", () => {
    const r = validate(createTransactionSchema, {
      date: "2026-01-15",
      amount: 100,
      sourceAccount: "AL_RAWA_BANK",
      destinationAccount: "INVALID_BANK",
    });
    expect(r.success).toBe(false);
  });

  it("allows null/undefined accounts for external income", () => {
    const r = validate(createTransactionSchema, {
      date: "2026-01-15",
      amount: 500,
      destinationAccount: "AL_RAWA_BANK",
      category: "Donation",
    });
    expect(r.success).toBe(true);
  });
});
