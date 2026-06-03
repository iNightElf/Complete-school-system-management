import { z } from 'zod';

export const createTransactionSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  amount: z.number().positive('Amount must be positive').min(0.01, 'Amount must be greater than 0'),
  type: z.enum(['INCOME', 'EXPENSE', 'INTERNAL_TRANSFER']),
  category: z.string().optional(),
  description: z.string().optional(),
  sourceAccount: z.string().optional(),
  destinationAccount: z.string().optional(),
  studentId: z.string().optional(),
  className: z.string().optional(),
  feeMonth: z.string().optional(),
  feeScheduleId: z.string().optional(),
}).refine(
  (data) => {
    if (data.type === 'INTERNAL_TRANSFER') {
      return data.sourceAccount !== data.destinationAccount;
    }
    return true;
  },
  { message: 'Source and destination accounts must be different for transfers', path: ['destinationAccount'] }
);

export const createStudentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  classId: z.string().min(1, 'Class is required'),
  roll: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  contact: z.string().optional(),
});

export const createClassSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
});

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  type: z.enum(['INCOME', 'EXPENSE']),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const feeScheduleSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  amount: z.number().positive('Amount must be positive'),
  frequency: z.enum(['MONTHLY', 'TERMLY', 'YEARLY', 'ONETIME']),
  classId: z.string().nullable().optional(),
  applicability: z.enum(['ALL', 'ASSIGNED_ONLY']).optional(),
});

export const openingBalancesSchema = z.object({
  AL_RAWA_BANK: z.number().min(0, 'Balance cannot be negative'),
  GLOBAL_FORUM_BANK: z.number().min(0, 'Balance cannot be negative'),
  CASH_IN_HAND: z.number().min(0, 'Balance cannot be negative'),
});
