import { z } from "zod";
import { INTERNAL_ACCOUNTS } from "./finance-rules.js";

function isValidAccount(acc: string | null | undefined): boolean {
  if (!acc) return true;
  if ((INTERNAL_ACCOUNTS as readonly string[]).includes(acc)) return true;
  return false;
}

export const createTransactionSchema = z.object({
  date: z.string().min(1, "Date is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  sourceAccount: z.string().max(100).optional().nullable(),
  destinationAccount: z.string().max(100).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  referenceId: z.string().max(255).optional().nullable(),
  studentId: z.string().uuid().optional().nullable(),
  className: z.string().max(100).optional().nullable(),
  feeMonth: z.string().max(20).optional().nullable(),
  feeScheduleId: z.string().uuid().optional().nullable(),
  totalIncomeCollected: z.number().optional().nullable(),
  directExpenseBeforeDeposit: z.number().optional().nullable(),
}).refine(data => {
  if (!isValidAccount(data.sourceAccount)) return false;
  if (!isValidAccount(data.destinationAccount)) return false;
  return true;
}, { message: "Invalid account name. Must be one of: AL_RAWA_BANK, GLOBAL_FORUM_BANK, CASH_IN_HAND" }).refine(data => {
  const src = data.sourceAccount;
  const dst = data.destinationAccount;
  if (src && dst && src === dst && (INTERNAL_ACCOUNTS as readonly string[]).includes(src)) {
    return false;
  }
  return true;
}, { message: "Source and destination accounts must be different" });

export const saveStudentResultSchema = z.object({
  session: z.string().optional().nullable(),
  term: z.string().min(1, "Term is required"),
  marks: z.record(z.string(), z.number()),
  attendance: z.object({ days: z.number(), present: z.number() }).optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
});

export const createStudentSchema = z.object({
  class: z.string().min(1, "Class is required"),
  roll: z.string().optional().nullable(),
  name: z.string().min(1, "Name is required").max(200),
  fatherName: z.string().max(200).optional().nullable(),
  motherName: z.string().max(200).optional().nullable(),
  contact: z.string().max(20).optional().nullable(),
});

export const createTeacherSchema = z.object({
  designation: z.string().min(1, "Designation is required").max(100),
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email").max(200).optional().nullable(),
  contact: z.string().max(20).optional().nullable(),
});

export const createStaffSchema = z.object({
  role: z.string().min(1, "Role is required").max(100),
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email").max(200).optional().nullable(),
  contact: z.string().max(20).optional().nullable(),
});

export const createBookSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  publication: z.string().max(200).optional().nullable(),
  mrp: z.number().min(0).optional(),
  discounted: z.number().min(0).optional(),
  sell: z.number().min(0).optional(),
  classId: z.string().uuid("Invalid class ID"),
});

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  const error = result.error.issues.map(e => e.message).join(", ");
  return { success: false, error };
}
