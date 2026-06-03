import { vi } from 'vitest';

// Shared mock factories for server integration tests

export const mockGetUser = vi.hoisted(() => vi.fn());

export const mockPrisma = vi.hoisted(() => {
  const tx = () => ({
    create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(),
    count: vi.fn(), upsert: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn(), delete: vi.fn(),
  });
  const m = {
    transaction: tx(),
    openingBalance: tx(),
    openingBalanceHistory: tx(),
    studentFeeAssignment: tx(),
    paymentAllocation: { create: vi.fn(), findMany: vi.fn() },
    studentIdCounter: { update: vi.fn() },
    student: tx(),
    teacher: tx(),
    staff: tx(),
    schoolClass: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    feeSchedule: tx(),
    feeWaiver: tx(),
    auditLog: tx(),
    academicYear: tx(),
    user: tx(),
    periodClose: tx(),
    reconciliation: tx(),
    receiptCounter: { upsert: vi.fn() },
    category: tx(),
    subject: tx(),
    book: tx(),
    result: tx(),
    settings: { findFirst: vi.fn(), upsert: vi.fn() },
    idempotencyKey: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  };
  m.$transaction = vi.fn((arg: any) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    if (typeof arg === 'function') return arg(m);
    return Promise.resolve([]);
  });
  return m;
});

export const baseUser = {
  id: 'user-1', name: 'Test User', email: 'test@example.com',
  emailVerified: true, image: null,
  createdAt: new Date(), updatedAt: new Date(),
};

export function makeUser(role: string) {
  return { ...baseUser, role, id: `user-${role}` };
}

export const users: Record<string, any> = {
  admin: makeUser('admin'),
  teacher: makeUser('teacher'),
  accountant: makeUser('accountant'),
  viewer: makeUser('viewer'),
};

export function mockTx(overrides = {}) {
  return {
    id: 'tx-1', transactionDate: new Date('2026-01-15'), amount: 1000,
    transactionType: 'INCOME', sourceAccount: null, destinationAccount: 'AL_RAWA_BANK',
    category: 'Tuition Fee', description: null,
    isCancelled: false, cancelledAt: null, cancelledBy: null, cancelReason: null,
    reversalOfId: null, studentId: null, className: null, feeMonth: null,
    affectsIncomeLedger: true, affectsExpenseLedger: false,
    referenceId: null, createdBy: 'user-1',
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

export function resetMocks() {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue(users.admin);
  mockPrisma.openingBalance.findMany.mockResolvedValue([]);
  mockPrisma.openingBalanceHistory.findMany.mockResolvedValue([]);
  mockPrisma.studentFeeAssignment.findMany.mockResolvedValue([]);
  mockPrisma.student.findMany.mockResolvedValue([]);
  mockPrisma.student.count.mockResolvedValue(0);
  mockPrisma.academicYear.findMany.mockResolvedValue([]);
  mockPrisma.user.findMany.mockResolvedValue([]);
  mockPrisma.periodClose.findFirst.mockResolvedValue(null);
  mockPrisma.$queryRaw.mockResolvedValue([{ al_rawa: '0', global_forum: '0', cash: '0' }]);
  mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: 0 });
  mockPrisma.transaction.groupBy.mockResolvedValue([]);
  mockPrisma.transaction.findMany.mockReset().mockResolvedValue([]);
  mockPrisma.transaction.count.mockReset().mockResolvedValue(0);
  mockPrisma.receiptCounter.upsert.mockResolvedValue({ fiscalYear: 2026, receiptType: 'INCOME', nextSequence: 1 });
  mockPrisma.studentIdCounter.update.mockResolvedValue({ id: 'singleton', prefix: 'S', nextValue: 1, padLength: 6 });
  mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
  mockPrisma.idempotencyKey.upsert.mockResolvedValue({ id: 'key', status: 200, body: {}, expiresAt: new Date() });
}
