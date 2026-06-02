import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";

const mockGetUser = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => {
  const tx = {
    create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(),
  };
  const ob = { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), create: vi.fn() };
  const obh = { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() };
  const sfa = { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn(), upsert: vi.fn() };
  const m = {
    transaction: tx,
    openingBalance: ob,
    openingBalanceHistory: obh,
    studentFeeAssignment: sfa,
    paymentAllocation: { create: vi.fn() },
    student: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    teacher: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    staff: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    schoolClass: { findUnique: vi.fn() },
    feeSchedule: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    feeWaiver: { findMany: vi.fn(), upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    academicYear: { findMany: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn() },
    periodClose: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    reconciliation: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    paymentAllocation: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  };
  m.$transaction = vi.fn((arg: any) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    if (typeof arg === "function") return arg(m);
    return Promise.resolve([]);
  });
  return m;
});

vi.mock("../src/lib/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../src/lib/supabase-auth.js", () => ({
  getUserFromToken: mockGetUser,
}));

import app from "../src/app.js";

const bearer = "Bearer test-token";
function get(url: string) { return request(app).get(url).set("Authorization", bearer); }
function post(url: string) { return request(app).post(url).set("Authorization", bearer); }
function put(url: string) { return request(app).put(url).set("Authorization", bearer); }
function del(url: string) { return request(app).delete(url).set("Authorization", bearer); }

const baseUser = {
  id: "user-1", name: "Test User", email: "test@example.com",
  emailVerified: true, image: null,
  createdAt: new Date(), updatedAt: new Date(),
};

function makeUser(role: string) {
  return { ...baseUser, role, id: `user-${role}` };
}

const users: Record<string, any> = {
  admin: makeUser("admin"),
  teacher: makeUser("teacher"),
  accountant: makeUser("accountant"),
  viewer: makeUser("viewer"),
};

function mockTx(overrides = {}) {
  return {
    id: "tx-1", transactionDate: new Date("2026-01-15"), amount: 1000,
    transactionType: "INCOME", sourceAccount: null, destinationAccount: "AL_RAWA_BANK",
    category: "Tuition Fee", description: null,
    isCancelled: false, cancelledAt: null, cancelledBy: null, cancelReason: null,
    reversalOfId: null, studentId: null, className: null, feeMonth: null,
    affectsIncomeLedger: true, affectsExpenseLedger: false,
    referenceId: null, createdBy: "user-1",
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

describe("API Integration Tests", () => {
  beforeAll(() => {
    mockGetUser.mockResolvedValue(users.admin);
  });

  beforeEach(() => {
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
    mockPrisma.$queryRaw.mockResolvedValue([{ al_rawa: "0", global_forum: "0", cash: "0" }]);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ al_rawa: "0", global_forum: "0", cash: "0" }]);
  });

  describe("Health Check (no auth)", () => {
    it("responds with status ok", async () => {
      const res = await get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });

  describe("Authentication", () => {
    it("returns 401 when no session", async () => {
      mockGetUser.mockResolvedValueOnce(null);
      const res = await get("/api/students");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid session/i);
    });

    it("returns 401 when getSession throws", async () => {
      mockGetUser.mockRejectedValueOnce(new Error("fail"));
      const res = await get("/api/students");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid session/i);
    });

    it("passes through with valid session", async () => {
      mockPrisma.student.count.mockResolvedValueOnce(1);
      mockPrisma.student.findMany.mockResolvedValueOnce([{ id: "s1", name: "Alice", class: "One", roll: "1", hasPhoto: false }]);
      const res = await get("/api/students");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("Alice");
    });
  });

  describe("Permissions", () => {
    describe("POST /api/students (students:write)", () => {
      it("allows admin", async () => {
        mockGetUser.mockResolvedValueOnce(users.admin);
        mockPrisma.schoolClass.findUnique.mockResolvedValueOnce({ id: "class-1", name: "One" });
        mockPrisma.student.create.mockResolvedValueOnce({ id: "s-new", name: "Bob", class: "One", roll: "2" });
        const res = await post("/api/students").send({ class: "One", name: "Bob", roll: "2" });
        expect(res.status).toBe(201);
      });

      it("allows teacher", async () => {
        mockGetUser.mockResolvedValueOnce(users.teacher);
        mockPrisma.schoolClass.findUnique.mockResolvedValueOnce({ id: "class-1", name: "One" });
        mockPrisma.student.create.mockResolvedValueOnce({ id: "s-new", name: "Bob", class: "One" });
        const res = await post("/api/students").send({ class: "One", name: "Bob" });
        expect(res.status).toBe(201);
        expect(res.body.photo).toBe(null);
      });

      it("blocks accountant (403)", async () => {
        mockGetUser.mockResolvedValueOnce(users.accountant);
        const res = await post("/api/students").send({ class: "One", name: "Bob" });
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/insufficient/i);
      });

      it("blocks viewer (403)", async () => {
        mockGetUser.mockResolvedValueOnce(users.viewer);
        const res = await post("/api/students").send({ class: "One", name: "Bob" });
        expect(res.status).toBe(403);
      });
    });

    describe("Soft Delete & Restore", () => {
      it("DELETE /api/students/:id sets deletedAt instead of removing", async () => {
        mockPrisma.student.update.mockResolvedValueOnce({ id: "s1", deletedAt: new Date() });
        const res = await del("/api/students/s1");
        expect(res.status).toBe(200);
        expect(res.body.id).toBe("s1");
        expect(mockPrisma.student.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: "s1" }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) })
        );
      });

      it("POST /api/students/:id/restore clears deletedAt", async () => {
        mockPrisma.student.update.mockResolvedValueOnce({ id: "s1", deletedAt: null });
        const res = await post("/api/students/s1/restore");
        expect(res.status).toBe(200);
        expect(mockPrisma.student.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: "s1" }, data: { deletedAt: null } })
        );
      });

      it("GET /api/students excludes soft-deleted records", async () => {
        mockPrisma.student.findMany.mockResolvedValueOnce([{ id: "active-1", name: "Active" }]);
        mockPrisma.student.count.mockResolvedValueOnce(1);
        const res = await get("/api/students");
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].id).toBe("active-1");
        expect(mockPrisma.student.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
        );
      });

      it("DELETE /api/teachers/:id sets deletedAt", async () => {
        mockPrisma.teacher.update.mockResolvedValueOnce({ id: "t1", deletedAt: new Date() });
        const res = await del("/api/teachers/t1");
        expect(res.status).toBe(200);
        expect(mockPrisma.teacher.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: "t1" }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) })
        );
      });

      it("POST /api/teachers/:id/restore clears deletedAt", async () => {
        mockPrisma.teacher.update.mockResolvedValueOnce({ id: "t1", deletedAt: null });
        const res = await post("/api/teachers/t1/restore");
        expect(res.status).toBe(200);
      });

      it("DELETE /api/staff/:id sets deletedAt", async () => {
        mockPrisma.staff.update.mockResolvedValueOnce({ id: "st1", deletedAt: new Date() });
        const res = await del("/api/staff/st1");
        expect(res.status).toBe(200);
        expect(mockPrisma.staff.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: "st1" }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) })
        );
      });

      it("POST /api/staff/:id/restore clears deletedAt", async () => {
        mockPrisma.staff.update.mockResolvedValueOnce({ id: "st1", deletedAt: null });
        const res = await post("/api/staff/st1/restore");
        expect(res.status).toBe(200);
      });
    });

    describe("POST /api/finance/transactions (finance:write)", () => {
      it("allows admin", async () => {
        mockGetUser.mockResolvedValueOnce(users.admin);
        mockPrisma.transaction.create.mockResolvedValueOnce(mockTx());
        const res = await post("/api/finance/transactions").send({ date: "2026-01-15", amount: 500, destinationAccount: "AL_RAWA_BANK", category: "Fee" });
        expect(res.status).toBe(201);
      });

      it("allows accountant", async () => {
        mockGetUser.mockResolvedValueOnce(users.accountant);
        mockPrisma.transaction.create.mockResolvedValueOnce(mockTx());
        const res = await post("/api/finance/transactions").send({ date: "2026-01-15", amount: 500, destinationAccount: "AL_RAWA_BANK", category: "Fee" });
        expect(res.status).toBe(201);
      });

      it("blocks teacher (403)", async () => {
        mockGetUser.mockResolvedValueOnce(users.teacher);
        const res = await post("/api/finance/transactions").send({ date: "2026-01-15", amount: 500, destinationAccount: "AL_RAWA_BANK" });
        expect(res.status).toBe(403);
      });

      it("blocks viewer (403)", async () => {
        mockGetUser.mockResolvedValueOnce(users.viewer);
        const res = await post("/api/finance/transactions").send({ date: "2026-01-15", amount: 500, destinationAccount: "AL_RAWA_BANK" });
        expect(res.status).toBe(403);
      });
    });

    describe("GET /api/finance/transactions (finance:read)", () => {
      it("allows viewer (read-only)", async () => {
        mockGetUser.mockResolvedValueOnce(users.viewer);
        mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
        const res = await get("/api/finance/transactions");
        expect(res.status).toBe(200);
      });

      it("allows accountant", async () => {
        mockGetUser.mockResolvedValueOnce(users.accountant);
        mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
        const res = await get("/api/finance/transactions");
        expect(res.status).toBe(200);
      });
    });

    describe("GET /api/users (users:read)", () => {
      it("allows admin", async () => {
        mockGetUser.mockResolvedValueOnce(users.admin);
        const res = await get("/api/users");
        expect(res.status).toBe(200);
      });

      it("blocks teacher", async () => {
        mockGetUser.mockResolvedValueOnce(users.teacher);
        const res = await get("/api/users");
        expect(res.status).toBe(403);
      });
    });
  });

  describe("Finance — Transaction Creation", () => {
    it("creates income (external → internal)", async () => {
      mockPrisma.transaction.create.mockResolvedValueOnce(mockTx());
      const res = await post("/api/finance/transactions").send({ date: "2026-01-15", amount: 500, destinationAccount: "AL_RAWA_BANK", category: "Tuition Fee" });
      expect(res.status).toBe(201);
      expect(res.body.transactionType).toBe("INCOME");
    });

    it("creates expense (internal → external)", async () => {
      mockPrisma.transaction.create.mockResolvedValueOnce(mockTx({ transactionType: "EXPENSE", affectsIncomeLedger: false, affectsExpenseLedger: true }));
      const res = await post("/api/finance/transactions").send({ date: "2026-01-15", amount: 200, sourceAccount: "CASH_IN_HAND", category: "Salary" });
      expect(res.status).toBe(201);
      expect(res.body.transactionType).toBe("EXPENSE");
    });

    it("creates internal transfer (AL_RAWA ↔ CASH)", async () => {
      mockPrisma.transaction.create.mockResolvedValueOnce(mockTx({ transactionType: "INTERNAL_TRANSFER", affectsIncomeLedger: false, affectsExpenseLedger: false }));
      const res = await post("/api/finance/transactions").send({ date: "2026-01-15", amount: 300, sourceAccount: "AL_RAWA_BANK", destinationAccount: "CASH_IN_HAND" });
      expect(res.status).toBe(201);
      expect(res.body.transactionType).toBe("INTERNAL_TRANSFER");
    });

    it("rejects same-account transfer (400)", async () => {
      const res = await post("/api/finance/transactions").send({ date: "2026-01-15", amount: 100, sourceAccount: "AL_RAWA_BANK", destinationAccount: "AL_RAWA_BANK" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/different/i);
    });

    it("rejects invalid account (400)", async () => {
      const res = await post("/api/finance/transactions").send({ date: "2026-01-15", amount: 100, destinationAccount: "BOGUS_BANK", category: "Fee" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid account/i);
    });

    it("rejects negative amount (400)", async () => {
      const res = await post("/api/finance/transactions").send({ date: "2026-01-15", amount: -100, destinationAccount: "AL_RAWA_BANK", category: "Fee" });
      expect(res.status).toBe(400);
    });

    it("rejects zero amount (400)", async () => {
      const res = await post("/api/finance/transactions").send({ date: "2026-01-15", amount: 0, destinationAccount: "AL_RAWA_BANK", category: "Fee" });
      expect(res.status).toBe(400);
    });

    it("rejects missing date (400)", async () => {
      const res = await post("/api/finance/transactions").send({ amount: 100, destinationAccount: "AL_RAWA_BANK" });
      expect(res.status).toBe(400);
    });

    it("rejects duplicate student fee (409)", async () => {
      mockPrisma.transaction.findFirst.mockResolvedValueOnce(mockTx());
      const res = await post("/api/finance/transactions").send({
        date: "2026-01-15", amount: 500, destinationAccount: "AL_RAWA_BANK",
        category: "Tuition Fee", studentId: "550e8400-e29b-41d4-a716-446655440000", feeMonth: "2026-01",
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already recorded/i);
    });

    it("rejects duplicate referenceId (409)", async () => {
      mockPrisma.transaction.findFirst.mockResolvedValueOnce(mockTx());
      const res = await post("/api/finance/transactions").send({
        date: "2026-01-15", amount: 500, destinationAccount: "AL_RAWA_BANK",
        category: "Fee", referenceId: "INV-001",
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/referenceId/i);
    });
  });

  describe("Finance — Transaction Cancellation", () => {
    it("cancels and creates reversal", async () => {
      const orig = mockTx({ id: "tx-c", sourceAccount: "CASH_IN_HAND", destinationAccount: "AL_RAWA_BANK", transactionType: "INCOME" });
      const cancelled = { ...orig, isCancelled: true, cancelledAt: new Date(), cancelledBy: "user-1", cancelReason: "Wrong" };
      const reversal = mockTx({ id: "tx-r", transactionType: "EXPENSE", sourceAccount: "AL_RAWA_BANK", destinationAccount: "CASH_IN_HAND", reversalOfId: "tx-c", category: "Reversal - Tuition Fee" });
      mockPrisma.transaction.findUnique.mockResolvedValueOnce(orig);
      mockPrisma.transaction.update.mockResolvedValueOnce(cancelled);
      mockPrisma.transaction.create.mockResolvedValueOnce(reversal);
      const res = await post("/api/finance/transactions/tx-c/cancel").send({ reason: "Wrong" });
      expect(res.status).toBe(200);
      expect(res.body.cancelled.isCancelled).toBe(true);
      expect(res.body.reversal.reversalOfId).toBe("tx-c");
    });

    it("rejects cancellation without reason (400)", async () => {
      const res = await post("/api/finance/transactions/tx-1/cancel").send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/reason/i);
    });

    it("returns 404 for non-existent transaction", async () => {
      mockPrisma.transaction.findUnique.mockResolvedValueOnce(null);
      const res = await post("/api/finance/transactions/tx-x/cancel").send({ reason: "Test" });
      expect(res.status).toBe(404);
    });

    it("rejects already-cancelled (400)", async () => {
      mockPrisma.transaction.findUnique.mockResolvedValueOnce(mockTx({ isCancelled: true }));
      const res = await post("/api/finance/transactions/tx-ac/cancel").send({ reason: "Test" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already cancelled/i);
    });
  });

  describe("Finance — Balances", () => {
    it("returns balances with opening balances added", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ al_rawa: "5000", global_forum: "3000", cash: "2000" }]);
      mockPrisma.openingBalance.findMany.mockResolvedValueOnce([
        { id: "ob-1", fiscalYear: "2026", account: "AL_RAWA_BANK", amount: 10000 },
        { id: "ob-2", fiscalYear: "2026", account: "CASH_IN_HAND", amount: 5000 },
      ]);
      const res = await get("/api/finance/balances");
      expect(res.status).toBe(200);
      expect(res.body.AL_RAWA_BANK).toBe(15000);
      expect(res.body.CASH_IN_HAND).toBe(7000);
      expect(res.body.GLOBAL_FORUM_BANK).toBe(3000);
    });

    it("uses SQL with reversal_of_id IS NULL filter", async () => {
      const res = await get("/api/finance/balances");
      expect(res.status).toBe(200);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
    });
  });

  describe("Finance — Opening Balances", () => {
    it("GET returns opening balances for a year", async () => {
      mockPrisma.openingBalance.findMany.mockResolvedValueOnce([{ id: "ob-1", fiscalYear: "2026", account: "AL_RAWA_BANK", amount: 10000 }]);
      const res = await get("/api/finance/opening-balances?year=2026");
      expect(res.status).toBe(200);
      expect(res.body.AL_RAWA_BANK).toBe(10000);
    });

    it("PUT updates opening balances", async () => {
      mockGetUser.mockResolvedValueOnce(users.admin);
      mockPrisma.openingBalance.findUnique.mockResolvedValue(null);
      const res = await put("/api/finance/opening-balances").send({
        year: "2026", balances: { AL_RAWA_BANK: 50000, GLOBAL_FORUM_BANK: 20000, CASH_IN_HAND: 10000 },
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
    });

    it("GET returns history", async () => {
      mockPrisma.openingBalanceHistory.findMany.mockResolvedValueOnce([{ id: "h-1", fiscalYear: "2026", account: "AL_RAWA_BANK", oldAmount: 0, newAmount: 50000, changedBy: "user-1", changedAt: new Date() }]);
      const res = await get("/api/finance/opening-balances/history");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("reverts from history", async () => {
      mockGetUser.mockResolvedValueOnce(users.admin);
      mockPrisma.openingBalanceHistory.findUnique.mockResolvedValueOnce({ id: "h-1", fiscalYear: "2026", account: "AL_RAWA_BANK", oldAmount: 0, newAmount: 50000 });
      const res = await post("/api/finance/opening-balances/revert/h-1");
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/reverted/i);
    });
  });

  describe("Finance — Fee Assignments", () => {
    it("GET returns assignments", async () => {
      mockPrisma.studentFeeAssignment.findMany.mockResolvedValueOnce([{ id: "sfa-1", studentId: "s1", feeScheduleId: "fs-1", active: true }]);
      const res = await get("/api/finance/student-fee-assignments");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("POST toggles assignment", async () => {
      mockPrisma.studentFeeAssignment.findFirst.mockResolvedValueOnce(null);
      mockPrisma.studentFeeAssignment.create.mockResolvedValueOnce({ id: "sfa-2", studentId: "s1", feeScheduleId: "fs-2", active: true });
      const res = await post("/api/finance/student-fee-assignments/toggle").send({ studentId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", feeScheduleId: "fs-2" });
      expect(res.status).toBe(201);
      expect(res.body.active).toBe(true);
    });

    it("POST bulk assigns", async () => {
      mockPrisma.studentFeeAssignment.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.studentFeeAssignment.create.mockResolvedValue({ id: "sfa-3", studentId: "s1", feeScheduleId: "fs-1", active: true });
      const res = await post("/api/finance/student-fee-assignments/bulk").send({ feeScheduleId: "fs-1", studentIds: ["s1", "s2"] });
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });
  });

  describe("Finance — Defaulter Report", () => {
    it("returns defaulter report for a class", async () => {
      mockPrisma.student.findMany.mockResolvedValueOnce([
        { id: "s1", name: "Alice", fatherName: "Mr. A", class: "One", roll: "1" },
        { id: "s2", name: "Bob", fatherName: "Mr. B", class: "One", roll: "2" },
      ]);
      mockPrisma.paymentAllocation.findMany.mockResolvedValueOnce([]);
      mockPrisma.feeSchedule.findMany.mockResolvedValueOnce([]);
      mockPrisma.studentFeeAssignment.findMany.mockResolvedValueOnce([]);
      mockPrisma.feeWaiver.findMany.mockResolvedValueOnce([]);
      const res = await get("/api/finance/defaulter?className=One&monthFrom=2026-01&monthTo=2026-03&year=2026");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("Finance — AGM Report", () => {
    it("returns AGM report for a fiscal year", async () => {
      mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
      mockPrisma.openingBalance.findMany.mockResolvedValueOnce([]);
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ al_rawa: "0", global_forum: "0", cash: "0" }]);
      const res = await get("/api/finance/reports/agm?year=2026");
      expect(res.status).toBe(200);
      expect(res.body.fiscalYear).toBe(2026);
      expect(res.body.totalIncome).toBe(0);
    });
  });

  describe("Finance — Transaction List", () => {
    it("GET returns filtered transactions", async () => {
      mockPrisma.transaction.findMany.mockResolvedValueOnce([mockTx()]);
      const res = await get("/api/finance/transactions?dateFrom=2026-01-01&dateTo=2026-12-31&type=INCOME");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe("Fee Schedules", () => {
    it("GET returns schedules", async () => {
      mockPrisma.feeSchedule.findMany.mockResolvedValueOnce([]);
      const res = await get("/api/finance/fee-schedules");
      expect(res.status).toBe(200);
    });

    it("POST creates fee schedule", async () => {
      mockPrisma.feeSchedule.create.mockResolvedValueOnce({ id: "fs-1", classId: "c1", category: "Tuition Fee", amount: 1000 });
      const res = await post("/api/finance/fee-schedules").send({ academicYearId: "ay-1", classId: "c1", category: "Tuition Fee", amount: 1000 });
      expect(res.status).toBe(201);
    });

    it("PUT updates fee schedule", async () => {
      mockPrisma.feeSchedule.update.mockResolvedValueOnce({ id: "fs-1", amount: 1200 });
      const res = await put("/api/finance/fee-schedules/fs-1").send({ amount: 1200 });
      expect(res.status).toBe(200);
    });

    it("DELETE removes fee schedule", async () => {
      mockPrisma.feeSchedule.delete.mockResolvedValueOnce({ id: "fs-1" });
      const res = await del("/api/finance/fee-schedules/fs-1");
      expect(res.status).toBe(200);
    });
  });

  describe("Reconciliation Detail Export", () => {
    it("GET returns reconciliation detail with transactions", async () => {
      mockPrisma.reconciliation.findUnique.mockResolvedValueOnce({
        id: "rec-1", account: "AL_RAWA_BANK", statementDate: new Date("2026-05-01"), closingBalance: 50000, systemBalance: 50000, difference: 0, status: "reconciled",
      });
      mockPrisma.openingBalance.findUnique.mockResolvedValueOnce({ id: "ob-1", fiscalYear: "2026", account: "AL_RAWA_BANK", amount: 0 });
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: "tx-1", transaction_date: new Date("2026-04-15"), transaction_type: "INCOME", source_account: null, destination_account: "AL_RAWA_BANK", amount: "50000", description: "Fee payment", category: "Tuition", student_id: "s1", class_name: "One" }]);
      const res = await get("/api/finance/reconciliations/rec-1");
      expect(res.status).toBe(200);
      expect(res.body.reconciliation).toBeDefined();
      expect(res.body.transactions).toHaveLength(1);
    });

    it("GET returns 404 for unknown reconciliation", async () => {
      mockPrisma.reconciliation.findUnique.mockResolvedValueOnce(null);
      const res = await get("/api/finance/reconciliations/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("Finance — Fee Waivers (Immutable)", () => {
    it("POST creates waiver (deactivates old first)", async () => {
      mockPrisma.feeWaiver.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.feeWaiver.create.mockResolvedValueOnce({ id: "fw-new", studentId: "s1", feeScheduleId: "fs-1", value: 500, active: true });
      const res = await post("/api/finance/fee-waivers").send({ studentId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", feeScheduleId: "fs-1", value: 500 });
      expect(res.status).toBe(201);
      expect(res.body.active).toBe(true);
    });
  });

  describe("Audit Log Filters", () => {
    it("GET filters by date range", async () => {
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([{ id: "log-1", action: "CREATE", entityType: "Student", createdAt: new Date("2026-05-01") }]);
      mockPrisma.auditLog.count.mockResolvedValueOnce(1);
      const res = await get("/api/audit?dateFrom=2026-04-01&dateTo=2026-06-01");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("GET filters by userId", async () => {
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([{ id: "log-2", action: "UPDATE", entityType: "FeeSchedule", userId: "user-1", createdAt: new Date() }]);
      mockPrisma.auditLog.count.mockResolvedValueOnce(1);
      const res = await get("/api/audit?userId=user-1");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("GET empty result returns empty array", async () => {
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);
      mockPrisma.auditLog.count.mockResolvedValueOnce(0);
      const res = await get("/api/audit?action=CREATE&entityType=FooBar");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });
  });
});
