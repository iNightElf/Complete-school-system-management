import { describe, it, expect } from "vitest";
import {
  validate,
  createTransactionSchema,
  saveStudentResultSchema,
  createStudentSchema,
  createTeacherSchema,
  createStaffSchema,
  createBookSchema,
  createSubjectSchema,
  updateSubjectSchema,
  setOpeningBalancesSchema,
  closePeriodSchema,
  createReconciliationSchema,
} from "../src/lib/validate.js";

const UUID_A = "550e8400-e29b-41d4-a716-446655440000";

function ok(schema: any, data: any) {
  const r = validate(schema, data);
  if (!r.success) throw new Error(`Expected success, got error: ${r.error}`);
  return r.data;
}

function fail(schema: any, data: any) {
  const r = validate(schema, data);
  if (r.success) throw new Error("Expected failure, got success");
  return r.error;
}

describe("validate helper", () => {
  it("returns success: true with parsed data on valid input", () => {
    const r = validate(createStudentSchema, { class: "5A", name: "Test" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Test");
  });

  it("returns success: false with joined error messages on invalid input", () => {
    const r = validate(createStudentSchema, { class: "", name: "" });
    expect(r.success).toBe(false);
  });
});

describe("createTransactionSchema", () => {
  it("accepts a valid income transaction", () => {
    ok(createTransactionSchema, {
      date: "2026-01-15",
      amount: 500,
      destinationAccount: "AL_RAWA_BANK",
      category: "Tuition Fee",
    });
  });

  it("accepts a valid expense transaction", () => {
    ok(createTransactionSchema, {
      date: "2026-01-15",
      amount: 200,
      sourceAccount: "CASH_IN_HAND",
      category: "Salary",
    });
  });

  it("accepts external income with no source", () => {
    ok(createTransactionSchema, {
      date: "2026-01-15",
      amount: 100,
    });
  });

  it("rejects missing date", () => {
    const err = fail(createTransactionSchema, { amount: 100 });
    expect(err).toContain("Invalid input");
  });

  it("rejects negative amount", () => {
    fail(createTransactionSchema, { date: "2026-01-15", amount: -100 });
  });

  it("rejects zero amount", () => {
    fail(createTransactionSchema, { date: "2026-01-15", amount: 0 });
  });

  it("rejects same internal account as source and destination", () => {
    const err = fail(createTransactionSchema, {
      date: "2026-01-15",
      amount: 100,
      sourceAccount: "AL_RAWA_BANK",
      destinationAccount: "AL_RAWA_BANK",
    });
    expect(err).toContain("different");
  });

  it("rejects invalid account name", () => {
    const err = fail(createTransactionSchema, {
      date: "2026-01-15",
      amount: 100,
      sourceAccount: "AL_RAWA_BANK",
      destinationAccount: "INVALID_BANK",
    });
    expect(err).toContain("Invalid account name");
  });

  it("allows null/undefined accounts for external income", () => {
    ok(createTransactionSchema, {
      date: "2026-01-15",
      amount: 500,
      destinationAccount: "AL_RAWA_BANK",
    });
  });

  describe("allocations validation", () => {
    const base = {
      date: "2026-01-15",
      amount: 1000,
      sourceAccount: "CASH_IN_HAND",
      destinationAccount: "AL_RAWA_BANK",
    };

    it("accepts valid allocations that sum to total", () => {
      ok(createTransactionSchema, {
        ...base,
        allocations: [
          { feeScheduleId: UUID_A, amount: 400, period: "Jan" },
          { feeScheduleId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8", amount: 600, period: "Feb" },
        ],
      });
    });

    it("rejects allocations that do not sum to amount", () => {
      const err = fail(createTransactionSchema, {
        ...base,
        allocations: [
          { feeScheduleId: UUID_A, amount: 300, period: "Jan" },
        ],
      });
      expect(err).toContain("Sum of allocations must equal total amount");
    });

    it("accepts empty allocations", () => {
      ok(createTransactionSchema, { ...base, allocations: [] });
    });

    it("rejects allocation with invalid uuid in feeScheduleId", () => {
      const err = fail(createTransactionSchema, {
        ...base,
        allocations: [
          { feeScheduleId: "not-a-uuid", amount: 400, period: "Jan" },
        ],
      });
      expect(err).toContain("Invalid feeScheduleId");
    });

    it("rejects allocation with negative amount", () => {
      const err = fail(createTransactionSchema, {
        ...base,
        allocations: [
          { feeScheduleId: UUID_A, amount: -100, period: "Jan" },
        ],
      });
      expect(err).toContain("must be greater than 0");
    });

    it("allows null allocations", () => {
      ok(createTransactionSchema, { ...base, allocations: null });
    });
  });
});

describe("saveStudentResultSchema", () => {
  it("accepts valid result data", () => {
    ok(saveStudentResultSchema, {
      term: "Term 1",
      marks: { Math: 85, English: 90 },
    });
  });

  it("accepts result with attendance and comment", () => {
    ok(saveStudentResultSchema, {
      term: "Term 1",
      marks: { Math: 85 },
      attendance: { days: 30, present: 28 },
      comment: "Good progress",
    });
  });

  it("accepts optional session", () => {
    ok(saveStudentResultSchema, {
      session: "2025-2026",
      term: "Term 1",
      marks: {},
    });
  });

  it("rejects missing term", () => {
    const err = fail(saveStudentResultSchema, { term: "", marks: { Math: 85 } });
    expect(err).toContain("Term is required");
  });

  it("rejects non-numeric marks", () => {
    const err = fail(saveStudentResultSchema, {
      term: "Term 1",
      marks: { Math: true },
    });
    expect(err).toBeTruthy();
  });
});

describe("createStudentSchema", () => {
  it("accepts minimal valid student", () => {
    const data = ok(createStudentSchema, { class: "5A", name: "John" });
    expect(data.name).toBe("John");
  });

  it("accepts student with all optional fields", () => {
    ok(createStudentSchema, {
      class: "5A",
      roll: "12",
      name: "John Doe",
      fatherName: "Mr. Doe",
      motherName: "Mrs. Doe",
      contact: "1234567890",
      session: "2025-2026",
    });
  });

  it("rejects missing class (empty string)", () => {
    const err = fail(createStudentSchema, { class: "", name: "" });
    expect(err).toContain("Class is required");
  });

  it("rejects missing name (empty string)", () => {
    const err = fail(createStudentSchema, { class: "5A", name: "" });
    expect(err).toContain("Name is required");
  });

  it("rejects name exceeding 200 characters", () => {
    fail(createStudentSchema, { class: "5A", name: "A".repeat(201) });
  });
});

describe("createTeacherSchema", () => {
  it("accepts valid teacher", () => {
    ok(createTeacherSchema, { designation: "Math Teacher", name: "Mr. Smith" });
  });

  it("accepts teacher with email and contact", () => {
    ok(createTeacherSchema, {
      designation: "Science Teacher",
      name: "Ms. Jones",
      email: "jones@school.com",
      contact: "9876543210",
    });
  });

  it("rejects missing designation (empty string)", () => {
    const err = fail(createTeacherSchema, { designation: "", name: "" });
    expect(err).toContain("Designation is required");
  });

  it("rejects invalid email", () => {
    const err = fail(createTeacherSchema, {
      designation: "Teacher",
      name: "Mr. X",
      email: "not-an-email",
    });
    expect(err).toContain("Invalid email");
  });
});

describe("createStaffSchema", () => {
  it("accepts valid staff", () => {
    ok(createStaffSchema, { role: "Librarian", name: "Mr. Ali" });
  });

  it("rejects missing role (empty string)", () => {
    const err = fail(createStaffSchema, { role: "", name: "" });
    expect(err).toContain("Role is required");
  });

  it("rejects invalid email", () => {
    const err = fail(createStaffSchema, {
      role: "Librarian",
      name: "Mr. Ali",
      email: "bad",
    });
    expect(err).toContain("Invalid email");
  });
});

describe("createBookSchema", () => {
  it("accepts valid book with all fields", () => {
    ok(createBookSchema, {
      name: "Math Textbook",
      publication: "Oxford",
      mrp: 500,
      discounted: 450,
      sell: 400,
      classId: UUID_A,
    });
  });

  it("accepts book with only required fields", () => {
    ok(createBookSchema, {
      name: "English Reader",
      classId: UUID_A,
    });
  });

  it("rejects missing name (empty string)", () => {
    const err = fail(createBookSchema, { name: "", classId: UUID_A });
    expect(err).toContain("Name is required");
  });

  it("rejects invalid classId", () => {
    const err = fail(createBookSchema, { name: "Book", classId: "not-uuid" });
    expect(err).toContain("Invalid class ID");
  });

  it("rejects negative prices", () => {
    fail(createBookSchema, { name: "Book", classId: UUID_A, mrp: -1 });
    fail(createBookSchema, { name: "Book", classId: UUID_A, discounted: -1 });
    fail(createBookSchema, { name: "Book", classId: UUID_A, sell: -1 });
  });
});

describe("createSubjectSchema", () => {
  it("accepts valid subject with numeric fullMarks", () => {
    const data = ok(createSubjectSchema, { name: "  Mathematics  ", fullMarks: 100 });
    expect(data.name).toBe("Mathematics");
    expect(data.fullMarks).toBe(100);
  });

  it("accepts string fullMarks and transforms to number", () => {
    const data = ok(createSubjectSchema, { name: "English", fullMarks: "75" });
    expect(data.fullMarks).toBe(75);
  });

  it("rejects missing name (empty string)", () => {
    const err = fail(createSubjectSchema, { name: "", fullMarks: 100 });
    expect(err).toContain("Name is required");
  });

  it("rejects non-positive fullMarks", () => {
    const err = fail(createSubjectSchema, { name: "Math", fullMarks: 0 });
    expect(err).toBeTruthy();
  });

  it("rejects non-numeric string fullMarks", () => {
    const err = fail(createSubjectSchema, { name: "Math", fullMarks: "abc" });
    expect(err).toBeTruthy();
  });
});

describe("updateSubjectSchema", () => {
  it("accepts partial update with name only", () => {
    const data = ok(updateSubjectSchema, { name: "  Advanced Math  " });
    expect(data.name).toBe("Advanced Math");
  });

  it("accepts partial update with fullMarks only", () => {
    const data = ok(updateSubjectSchema, { fullMarks: "90" });
    expect(data.fullMarks).toBe(90);
  });

  it("accepts empty object (no fields to update)", () => {
    ok(updateSubjectSchema, {});
  });

  it("rejects non-positive fullMarks", () => {
    fail(updateSubjectSchema, { fullMarks: -1 });
  });
});

describe("setOpeningBalancesSchema", () => {
  it("accepts valid balances", () => {
    ok(setOpeningBalancesSchema, {
      balances: { "CASH_IN_HAND": 5000, "AL_RAWA_BANK": 10000 },
    });
  });

  it("accepts year as string", () => {
    ok(setOpeningBalancesSchema, {
      year: "2026",
      balances: {},
    });
  });

  it("accepts year as number", () => {
    ok(setOpeningBalancesSchema, {
      year: 2026,
      balances: {},
    });
  });

  it("rejects missing balances", () => {
    const err = fail(setOpeningBalancesSchema, {});
    expect(err).toContain("Invalid input");
  });
});

describe("closePeriodSchema", () => {
  it("accepts valid close period with notes", () => {
    ok(closePeriodSchema, { fiscalYear: 2026, notes: "Year-end close" });
  });

  it("accepts valid close period without notes", () => {
    ok(closePeriodSchema, { fiscalYear: 2026 });
  });

  it("rejects zero fiscalYear", () => {
    const err = fail(closePeriodSchema, { fiscalYear: 0 });
    expect(err).toContain("fiscalYear is required");
  });

  it("rejects negative fiscalYear", () => {
    const err = fail(closePeriodSchema, { fiscalYear: -1 });
    expect(err).toContain("fiscalYear is required");
  });

  it("rejects missing fiscalYear", () => {
    const err = fail(closePeriodSchema, {});
    expect(err).toContain("Invalid input");
  });
});

describe("createReconciliationSchema", () => {
  it("accepts valid reconciliation", () => {
    ok(createReconciliationSchema, {
      account: "AL_RAWA_BANK",
      statementDate: "2026-03-31",
      closingBalance: 50000,
    });
  });

  it("accepts reconciliation with notes", () => {
    ok(createReconciliationSchema, {
      account: "CASH_IN_HAND",
      statementDate: "2026-03-31",
      closingBalance: 10000,
      notes: "All matched",
    });
  });

  it("rejects missing account (empty string)", () => {
    const err = fail(createReconciliationSchema, {
      account: "",
      statementDate: "2026-03-31",
      closingBalance: 50000,
    });
    expect(err).toContain("Account is required");
  });

  it("rejects missing statementDate (empty string)", () => {
    const err = fail(createReconciliationSchema, {
      account: "AL_RAWA_BANK",
      statementDate: "",
      closingBalance: 50000,
    });
    expect(err).toContain("Statement date is required");
  });
});
