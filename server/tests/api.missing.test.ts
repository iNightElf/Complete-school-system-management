import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";

const mockGetUser = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => {
  const tx = {
    create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(),
    count: vi.fn(), upsert: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn(),
  };
  const ob = { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), create: vi.fn() };
  const obh = { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() };
  const sfa = { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn(), upsert: vi.fn(), createMany: vi.fn() };
  const m = {
    transaction: tx,
    openingBalance: ob,
    openingBalanceHistory: obh,
    studentFeeAssignment: sfa,
    paymentAllocation: { create: vi.fn(), findMany: vi.fn() },
    studentIdCounter: { update: vi.fn() },
    student: {
      findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(),
      aggregate: vi.fn(), createManyAndReturn: vi.fn(), updateMany: vi.fn(), groupBy: vi.fn(),
    },
    teacher: {
      findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(),
      createManyAndReturn: vi.fn(),
    },
    staff: {
      findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(),
      createManyAndReturn: vi.fn(),
    },
    schoolClass: {
      findUnique: vi.fn(), findMany: vi.fn(), aggregate: vi.fn(), create: vi.fn(), update: vi.fn(),
      delete: vi.fn(), groupBy: vi.fn(), updateMany: vi.fn(), count: vi.fn(),
    },
    subject: {
      findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), aggregate: vi.fn(),
      deleteMany: vi.fn(), createMany: vi.fn(), findUnique: vi.fn(),
    },
    result: {
      findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    category: {
      findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn(),
    },
    book: {
      findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(),
      createMany: vi.fn(), findUnique: vi.fn(),
    },
    schoolSetting: {
      findMany: vi.fn(), upsert: vi.fn(),
    },
    feeSchedule: {
      findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(),
      createMany: vi.fn(),
    },
    feeWaiver: {
      findMany: vi.fn(), upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(), findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(),
    },
    academicYear: {
      findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), update: vi.fn(), delete: vi.fn(),
    },
    periodClose: {
      findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(),
    },
    reconciliation: {
      findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), count: vi.fn(),
    },
    receiptCounter: { upsert: vi.fn() },
    idempotencyKey: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
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
  updateUserRole: vi.fn().mockResolvedValue(undefined),
  deleteAuthUser: vi.fn().mockResolvedValue(undefined),
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

describe("API — Missing Controller Tests", () => {
  beforeAll(() => {
    mockGetUser.mockResolvedValue(users.admin);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(users.admin);
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.student.count.mockResolvedValue(0);
    mockPrisma.teacher.findMany.mockResolvedValue([]);
    mockPrisma.teacher.count.mockResolvedValue(0);
    mockPrisma.staff.findMany.mockResolvedValue([]);
    mockPrisma.staff.count.mockResolvedValue(0);
    mockPrisma.book.findMany.mockResolvedValue([]);
    mockPrisma.book.count.mockResolvedValue(0);
    mockPrisma.schoolClass.findMany.mockResolvedValue([]);
    mockPrisma.schoolClass.aggregate.mockResolvedValue({ _max: { order: 0 } });
    mockPrisma.schoolClass.findUnique.mockResolvedValue(null);
    mockPrisma.subject.findMany.mockResolvedValue([]);
    mockPrisma.subject.aggregate.mockResolvedValue({ _max: { order: -1 } });
    mockPrisma.result.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);
    mockPrisma.academicYear.findMany.mockResolvedValue([]);
    mockPrisma.academicYear.findUnique.mockResolvedValue(null);
    mockPrisma.periodClose.findMany.mockResolvedValue([]);
    mockPrisma.periodClose.findUnique.mockResolvedValue(null);
    mockPrisma.reconciliation.findMany.mockResolvedValue([]);
    mockPrisma.reconciliation.count.mockResolvedValue(0);
    mockPrisma.schoolSetting.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.auditLog.groupBy.mockResolvedValue([]);
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    mockPrisma.studentIdCounter.update.mockResolvedValue({ id: "singleton", prefix: "S", nextValue: 1, padLength: 6 });
  });

  // ── Classes ──

  describe("Classes — GET /api/classes (classes:read)", () => {
    it("returns classes with counts", async () => {
      mockPrisma.schoolClass.findMany.mockResolvedValueOnce([
        { id: "c1", name: "One", order: 0, _count: { books: 2, subjects: 3 } },
        { id: "c2", name: "Two", order: 1, _count: { books: 0, subjects: 0 } },
      ]);
      mockPrisma.student.groupBy.mockResolvedValueOnce([
        { class: "One", _count: 5 },
      ]);
      const res = await get("/api/classes");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].studentCount).toBe(5);
      expect(res.body[0].bookCount).toBe(2);
      expect(res.body[0].subjectCount).toBe(3);
      expect(res.body[1].studentCount).toBe(0);
    });

    it("allows viewer (read-only)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      mockPrisma.schoolClass.findMany.mockResolvedValueOnce([]);
      mockPrisma.student.groupBy.mockResolvedValueOnce([]);
      const res = await get("/api/classes");
      expect(res.status).toBe(200);
    });
  });

  describe("Classes — POST /api/classes (classes:write)", () => {
    it("creates class (admin)", async () => {
      mockPrisma.schoolClass.aggregate.mockResolvedValueOnce({ _max: { order: 2 } });
      mockPrisma.schoolClass.create.mockResolvedValueOnce({ id: "c-new", name: "Four", order: 3 });
      const res = await post("/api/classes").send({ name: "Four" });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Four");
    });

    it("rejects missing name (400)", async () => {
      const res = await post("/api/classes").send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/name/i);
    });

    it("rejects duplicate name (400)", async () => {
      mockPrisma.schoolClass.create.mockRejectedValueOnce({ code: "P2002" });
      const res = await post("/api/classes").send({ name: "One" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await post("/api/classes").send({ name: "New" });
      expect(res.status).toBe(403);
    });
  });

  describe("Classes — DELETE /api/classes/:id (classes:write)", () => {
    it("deletes existing class (admin)", async () => {
      mockPrisma.schoolClass.findUnique.mockResolvedValueOnce({ id: "c1", name: "One" });
      mockPrisma.schoolClass.delete.mockResolvedValueOnce({ id: "c1" });
      const res = await del("/api/classes/c1");
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
    });

    it("returns 404 for missing class", async () => {
      mockPrisma.schoolClass.findUnique.mockResolvedValueOnce(null);
      const res = await del("/api/classes/nonexistent");
      expect(res.status).toBe(404);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await del("/api/classes/c1");
      expect(res.status).toBe(403);
    });
  });

  describe("Classes — PUT /api/classes/reorder (classes:write)", () => {
    it("reorders classes (admin)", async () => {
      mockPrisma.schoolClass.update.mockResolvedValue({});
      mockPrisma.$transaction.mockImplementationOnce((cb: any) => {
        if (typeof cb === "function") return cb(mockPrisma);
        if (Array.isArray(cb)) return Promise.all(cb);
        return Promise.resolve([]);
      });
      const res = await put("/api/classes/reorder").send({ orderedIds: ["c1", "c2"] });
      expect(res.status).toBe(200);
    });

    it("rejects non-array orderedIds (400)", async () => {
      const res = await put("/api/classes/reorder").send({ orderedIds: "not-array" });
      expect(res.status).toBe(400);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await put("/api/classes/reorder").send({ orderedIds: ["c1"] });
      expect(res.status).toBe(403);
    });
  });

  describe("Classes — POST /api/classes/promote-all (classes:write)", () => {
    it("dry-run returns promotion plan (admin)", async () => {
      mockPrisma.schoolClass.findMany.mockResolvedValueOnce([
        { id: "c1", name: "Play", order: 0 },
      ]);
      mockPrisma.student.findMany.mockResolvedValueOnce([
        { id: "s1", classId: "c1" },
      ]);
      mockPrisma.feeSchedule.findMany.mockResolvedValue([]);
      mockPrisma.book.findMany.mockResolvedValue([]);
      mockPrisma.subject.findMany.mockResolvedValue([]);
      const res = await post("/api/classes/promote-all?dryRun=true").send({
        targetYearName: "2026-27",
      });
      expect(res.status).toBe(200);
      expect(res.body.dryRun).toBe(true);
      expect(res.body.promoted).toBeDefined();
    });

    it("rejects missing targetYearName (400)", async () => {
      const res = await post("/api/classes/promote-all").send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/targetYearName/i);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await post("/api/classes/promote-all").send({ targetYearName: "2026-27" });
      expect(res.status).toBe(403);
    });
  });

  // ── Subjects ──

  describe("Subjects — GET /api/classes/:classId/subjects (subjects:read)", () => {
    it("returns subjects for class", async () => {
      mockPrisma.schoolClass.findUnique.mockResolvedValueOnce({ id: "c1", name: "One" });
      mockPrisma.subject.findMany.mockResolvedValueOnce([
        { id: "sub1", name: "Math", fullMarks: 100, order: 0 },
      ]);
      const res = await get("/api/classes/c1/subjects");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("returns 404 for missing class", async () => {
      mockPrisma.schoolClass.findUnique.mockResolvedValueOnce(null);
      const res = await get("/api/classes/bogus/subjects");
      expect(res.status).toBe(404);
    });

    it("allows viewer (read-only)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      mockPrisma.schoolClass.findUnique.mockResolvedValueOnce({ id: "c1", name: "One" });
      mockPrisma.subject.findMany.mockResolvedValueOnce([]);
      const res = await get("/api/classes/c1/subjects");
      expect(res.status).toBe(200);
    });
  });

  describe("Subjects — POST /api/classes/:classId/subjects (subjects:write)", () => {
    it("creates subject (admin)", async () => {
      mockPrisma.schoolClass.findUnique.mockResolvedValueOnce({ id: "c1", name: "One" });
      mockPrisma.subject.aggregate.mockResolvedValueOnce({ _max: { order: 2 } });
      mockPrisma.subject.create.mockResolvedValueOnce({ id: "sub-new", name: "Science", fullMarks: 100, order: 3 });
      const res = await post("/api/classes/c1/subjects").send({ name: "Science", fullMarks: 100 });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Science");
    });

    it("returns 400 for missing field", async () => {
      const res = await post("/api/classes/c1/subjects").send({ name: "Science" });
      expect(res.status).toBe(400);
    });

    it("returns 404 for missing class", async () => {
      mockPrisma.schoolClass.findUnique.mockResolvedValueOnce(null);
      const res = await post("/api/classes/bogus/subjects").send({ name: "Science", fullMarks: 100 });
      expect(res.status).toBe(404);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await post("/api/classes/c1/subjects").send({ name: "Sci", fullMarks: 100 });
      expect(res.status).toBe(403);
    });
  });

  describe("Subjects — PUT /api/subjects/:id (subjects:write)", () => {
    it("updates subject (admin)", async () => {
      mockPrisma.subject.update.mockResolvedValueOnce({ id: "sub1", name: "Math Updated", fullMarks: 100 });
      const res = await put("/api/subjects/sub1").send({ name: "Math Updated" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Math Updated");
    });

    it("returns 400 for invalid payload", async () => {
      const res = await put("/api/subjects/sub1").send({ fullMarks: "not-a-number" });
      expect(res.status).toBe(400);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await put("/api/subjects/sub1").send({ name: "X" });
      expect(res.status).toBe(403);
    });
  });

  describe("Subjects — DELETE /api/subjects/:id (subjects:write)", () => {
    it("deletes subject (admin)", async () => {
      mockPrisma.subject.delete.mockResolvedValueOnce({ id: "sub1" });
      const res = await del("/api/subjects/sub1");
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await del("/api/subjects/sub1");
      expect(res.status).toBe(403);
    });
  });

  // ── Results ──

  describe("Results — GET /api/students/:id/results (results:read)", () => {
    it("returns student results", async () => {
      mockPrisma.student.findUnique.mockResolvedValueOnce({ id: "s1", name: "Alice" });
      mockPrisma.result.findMany.mockResolvedValueOnce([
        { id: "r1", studentId: "s1", term: "Term 1", marks: { Math: 85 }, session: "2026" },
      ]);
      const res = await get("/api/students/s1/results");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("returns 404 for missing student", async () => {
      mockPrisma.student.findUnique.mockResolvedValueOnce(null);
      const res = await get("/api/students/bogus/results");
      expect(res.status).toBe(404);
    });

    it("filters by session query param", async () => {
      mockPrisma.student.findUnique.mockResolvedValueOnce({ id: "s1" });
      mockPrisma.result.findMany.mockResolvedValueOnce([]);
      const res = await get("/api/students/s1/results?session=2026");
      expect(res.status).toBe(200);
      expect(mockPrisma.result.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ session: "2026" }) })
      );
    });

    it("allows viewer (read-only)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      mockPrisma.student.findUnique.mockResolvedValueOnce({ id: "s1" });
      mockPrisma.result.findMany.mockResolvedValueOnce([]);
      const res = await get("/api/students/s1/results");
      expect(res.status).toBe(200);
    });
  });

  describe("Results — POST /api/students/:id/results (results:write)", () => {
    it("saves/upserts student result", async () => {
      mockPrisma.student.findUnique.mockResolvedValueOnce({ id: "s1", name: "Alice" });
      mockPrisma.$transaction.mockImplementationOnce((cb: any) => {
        if (typeof cb === "function") {
          const tx = mockPrisma;
          tx.result.findUnique = vi.fn().mockResolvedValueOnce(null);
          tx.result.upsert = vi.fn().mockResolvedValueOnce({
            id: "r-new", studentId: "s1", term: "Term 1", marks: { Math: 85 }, session: "2026",
          });
          return cb(tx);
        }
        return Promise.resolve([]);
      });
      const res = await post("/api/students/s1/results").send({
        term: "Term 1", marks: { Math: 85 }, session: "2026",
      });
      expect(res.status).toBe(200);
      expect(res.body.term).toBe("Term 1");
    });

    it("returns 400 when term or marks missing", async () => {
      const res = await post("/api/students/s1/results").send({ marks: { Math: 85 } });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/term/i);
    });

    it("returns 404 for missing student", async () => {
      mockPrisma.student.findUnique.mockResolvedValueOnce(null);
      const res = await post("/api/students/bogus/results").send({ term: "T1", marks: { M: 50 } });
      expect(res.status).toBe(404);
    });

    it("blocks accountant (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.accountant);
      const res = await post("/api/students/s1/results").send({ term: "T1", marks: { M: 50 } });
      expect(res.status).toBe(403);
    });
  });

  describe("Results — GET /api/classes/:classId/results (results:read)", () => {
    it("returns class results", async () => {
      mockPrisma.schoolClass.findUnique.mockResolvedValueOnce({ id: "c1", name: "One" });
      mockPrisma.result.findMany.mockResolvedValueOnce([
        { id: "r1", studentId: "s1", term: "T1", marks: { Math: 85 } },
      ]);
      const res = await get("/api/classes/c1/results");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("returns 404 for missing class", async () => {
      mockPrisma.schoolClass.findUnique.mockResolvedValueOnce(null);
      const res = await get("/api/classes/bogus/results");
      expect(res.status).toBe(404);
    });

    it("allows viewer (read-only)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      mockPrisma.schoolClass.findUnique.mockResolvedValueOnce({ id: "c1", name: "One" });
      mockPrisma.result.findMany.mockResolvedValueOnce([]);
      const res = await get("/api/classes/c1/results");
      expect(res.status).toBe(200);
    });
  });

  describe("Results — DELETE /api/classes/:classId/results (results:write)", () => {
    it("deletes all results for a class", async () => {
      mockPrisma.schoolClass.findUnique.mockResolvedValueOnce({ id: "c1", name: "One" });
      mockPrisma.student.findMany.mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }]);
      mockPrisma.result.deleteMany.mockResolvedValueOnce({ count: 2 });
      const res = await del("/api/classes/c1/results");
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
    });

    it("returns 404 for missing class", async () => {
      mockPrisma.schoolClass.findUnique.mockResolvedValueOnce(null);
      const res = await del("/api/classes/bogus/results");
      expect(res.status).toBe(404);
    });

    it("blocks account (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.accountant);
      const res = await del("/api/classes/c1/results");
      expect(res.status).toBe(403);
    });
  });

  describe("Results — DELETE /api/classes/:classId/subjects (subjects:write)", () => {
    it("deletes all subjects for a class", async () => {
      mockPrisma.schoolClass.findUnique.mockResolvedValueOnce({ id: "c1", name: "One" });
      mockPrisma.subject.deleteMany.mockResolvedValueOnce({ count: 3 });
      const res = await del("/api/classes/c1/subjects");
      expect(res.status).toBe(200);
    });

    it("returns 404 for missing class", async () => {
      mockPrisma.schoolClass.findUnique.mockResolvedValueOnce(null);
      const res = await del("/api/classes/bogus/subjects");
      expect(res.status).toBe(404);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await del("/api/classes/c1/subjects");
      expect(res.status).toBe(403);
    });
  });

  // ── Academic Years ──

  describe("AcademicYears — GET /api/academic-years (academic-years:read)", () => {
    it("returns academic years", async () => {
      mockPrisma.academicYear.findMany.mockResolvedValueOnce([
        { id: "ay1", name: "2026-27", startDate: new Date(), endDate: new Date(), isActive: true },
      ]);
      const res = await get("/api/academic-years");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("allows viewer (read-only)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      mockPrisma.academicYear.findMany.mockResolvedValueOnce([]);
      const res = await get("/api/academic-years");
      expect(res.status).toBe(200);
    });
  });

  describe("AcademicYears — POST /api/academic-years (academic-years:write)", () => {
    it("creates academic year (admin)", async () => {
      mockPrisma.academicYear.findUnique.mockResolvedValueOnce(null);
      mockPrisma.academicYear.create.mockResolvedValueOnce({
        id: "ay-new", name: "2027-28", startDate: new Date(), endDate: new Date(), isActive: false,
      });
      const res = await post("/api/academic-years").send({
        name: "2027-28", startDate: "2027-04-01", endDate: "2028-03-31",
      });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("2027-28");
    });

    it("rejects missing fields (400)", async () => {
      const res = await post("/api/academic-years").send({ name: "2027-28" });
      expect(res.status).toBe(400);
    });

    it("rejects duplicate name (409)", async () => {
      mockPrisma.academicYear.findUnique.mockResolvedValueOnce({ id: "ay1", name: "2027-28" });
      const res = await post("/api/academic-years").send({
        name: "2027-28", startDate: "2027-04-01", endDate: "2028-03-31",
      });
      expect(res.status).toBe(409);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await post("/api/academic-years").send({
        name: "2027-28", startDate: "2027-04-01", endDate: "2028-03-31",
      });
      expect(res.status).toBe(403);
    });
  });

  describe("AcademicYears — PUT /api/academic-years/:id (academic-years:write)", () => {
    it("updates academic year (admin)", async () => {
      mockPrisma.academicYear.update.mockResolvedValueOnce({
        id: "ay1", name: "2026-27 Updated", isActive: false,
      });
      const res = await put("/api/academic-years/ay1").send({ name: "2026-27 Updated" });
      expect(res.status).toBe(200);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await put("/api/academic-years/ay1").send({ name: "X" });
      expect(res.status).toBe(403);
    });
  });

  // ── Categories ──

  describe("Categories — GET /api/categories (no permission gate)", () => {
    it("returns categories", async () => {
      mockPrisma.category.findMany.mockResolvedValueOnce([
        { id: "cat1", type: "INCOME", name: "Tuition Fee" },
      ]);
      const res = await get("/api/categories");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("filters by type query param", async () => {
      mockPrisma.category.findMany.mockResolvedValueOnce([]);
      const res = await get("/api/categories?type=EXPENSE");
      expect(res.status).toBe(200);
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: "EXPENSE" } })
      );
    });

    it("allows viewer", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      mockPrisma.category.findMany.mockResolvedValueOnce([]);
      const res = await get("/api/categories");
      expect(res.status).toBe(200);
    });
  });

  describe("Categories — POST /api/categories (finance:write)", () => {
    it("creates category (admin)", async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(null);
      mockPrisma.category.create.mockResolvedValueOnce({ id: "cat-new", type: "INCOME", name: "New Fee" });
      const res = await post("/api/categories").send({ type: "INCOME", name: "New Fee" });
      expect(res.status).toBe(201);
    });

    it("rejects missing fields (400)", async () => {
      const res = await post("/api/categories").send({ type: "INCOME" });
      expect(res.status).toBe(400);
    });

    it("rejects duplicate (409)", async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce({ id: "cat1", type: "INCOME", name: "Exists" });
      const res = await post("/api/categories").send({ type: "INCOME", name: "Exists" });
      expect(res.status).toBe(409);
    });

    it("blocks viewer (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      const res = await post("/api/categories").send({ type: "INCOME", name: "New" });
      expect(res.status).toBe(403);
    });
  });

  describe("Categories — PUT /api/categories/:id (finance:write)", () => {
    it("updates category (admin)", async () => {
      mockPrisma.category.update.mockResolvedValueOnce({ id: "cat1", type: "INCOME", name: "Renamed" });
      const res = await put("/api/categories/cat1").send({ name: "Renamed" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Renamed");
    });

    it("rejects missing name (400)", async () => {
      const res = await put("/api/categories/cat1").send({});
      expect(res.status).toBe(400);
    });

    it("blocks viewer (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      const res = await put("/api/categories/cat1").send({ name: "X" });
      expect(res.status).toBe(403);
    });
  });

  describe("Categories — DELETE /api/categories/:id (finance:write)", () => {
    it("deletes category (admin)", async () => {
      mockPrisma.category.delete.mockResolvedValueOnce({ id: "cat1" });
      const res = await del("/api/categories/cat1");
      expect(res.status).toBe(200);
    });

    it("blocks viewer (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      const res = await del("/api/categories/cat1");
      expect(res.status).toBe(403);
    });
  });

  // ── Teachers CRUD (ops) ──

  describe("Teachers — GET /api/teachers (teachers:read)", () => {
    it("returns teachers with pagination", async () => {
      mockPrisma.teacher.findMany.mockResolvedValueOnce([
        { id: "t1", designation: "Class Teacher", name: "Mr. A", email: null, contact: null, photoPath: null, photo: null, createdAt: new Date() },
      ]);
      mockPrisma.teacher.count.mockResolvedValueOnce(1);
      const res = await get("/api/teachers");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it("allows viewer (read-only)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      mockPrisma.teacher.findMany.mockResolvedValueOnce([]);
      mockPrisma.teacher.count.mockResolvedValueOnce(0);
      const res = await get("/api/teachers");
      expect(res.status).toBe(200);
    });
  });

  describe("Teachers — POST /api/teachers (teachers:write)", () => {
    it("creates teacher (admin)", async () => {
      mockPrisma.teacher.create.mockResolvedValueOnce({
        id: "t-new", designation: "Class Teacher", name: "Mr. B", email: null, contact: null, createdAt: new Date(),
      });
      const res = await post("/api/teachers").send({ designation: "Class Teacher", name: "Mr. B" });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Mr. B");
    });

    it("rejects missing fields (400)", async () => {
      const res = await post("/api/teachers").send({ name: "Mr. B" });
      expect(res.status).toBe(400);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await post("/api/teachers").send({ designation: "CT", name: "X" });
      expect(res.status).toBe(403);
    });
  });

  describe("Teachers — POST /api/teachers/import (teachers:write)", () => {
    it("imports batch of teachers", async () => {
      mockPrisma.teacher.createManyAndReturn.mockResolvedValueOnce([
        { id: "t1", name: "A", designation: "CT" },
        { id: "t2", name: "B", designation: "PT" },
      ]);
      const res = await post("/api/teachers/import").send({
        teachers: [{ name: "A", designation: "CT" }, { name: "B", designation: "PT" }],
      });
      expect(res.status).toBe(201);
      expect(res.body.created).toBe(2);
    });

    it("rejects empty array (400)", async () => {
      const res = await post("/api/teachers/import").send({ teachers: [] });
      expect(res.status).toBe(400);
    });

    it("reports per-row errors for invalid entries", async () => {
      mockPrisma.teacher.createManyAndReturn.mockResolvedValueOnce([
        { id: "t1", name: "Valid", designation: "CT" },
      ]);
      const res = await post("/api/teachers/import").send({
        teachers: [
          { name: "Valid", designation: "CT" },
          { name: "", designation: "CT" },
          { name: "NoDesig", designation: "" },
        ],
      });
      expect(res.status).toBe(201);
      expect(res.body.created).toBe(1);
      expect(res.body.errors).toHaveLength(2);
    });
  });

  describe("Teachers — PUT /api/teachers/:id (teachers:write)", () => {
    it("updates teacher (admin)", async () => {
      mockPrisma.teacher.findUnique.mockResolvedValueOnce({ photoPath: null });
      mockPrisma.teacher.update.mockResolvedValueOnce({
        id: "t1", designation: "Sr. Teacher", name: "Mr. A", email: null, contact: null, photoPath: null, createdAt: new Date(),
      });
      const res = await put("/api/teachers/t1").send({ designation: "Sr. Teacher" });
      expect(res.status).toBe(200);
      expect(res.body.designation).toBe("Sr. Teacher");
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await put("/api/teachers/t1").send({ name: "X" });
      expect(res.status).toBe(403);
    });
  });

  describe("Teachers — GET /api/teachers/:id/photo (teachers:read)", () => {
    it("returns 404 when no photo", async () => {
      mockPrisma.teacher.findUnique.mockResolvedValueOnce({ photo: null, photoPath: null });
      const res = await get("/api/teachers/t1/photo");
      expect(res.status).toBe(404);
    });

    it("allows viewer (read-only)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      mockPrisma.teacher.findUnique.mockResolvedValueOnce({ photo: null, photoPath: null });
      const res = await get("/api/teachers/t1/photo");
      expect(res.status).toBe(404);
    });
  });

  // ── Staff CRUD (ops) ──

  describe("Staff — GET /api/staff (staff:read)", () => {
    it("returns staff with pagination", async () => {
      mockPrisma.staff.findMany.mockResolvedValueOnce([
        { id: "st1", role: "Clerk", name: "Mr. C", email: null, contact: null, photoPath: null, photo: null, createdAt: new Date() },
      ]);
      mockPrisma.staff.count.mockResolvedValueOnce(1);
      const res = await get("/api/staff");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("allows viewer (read-only)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      mockPrisma.staff.findMany.mockResolvedValueOnce([]);
      mockPrisma.staff.count.mockResolvedValueOnce(0);
      const res = await get("/api/staff");
      expect(res.status).toBe(200);
    });
  });

  describe("Staff — POST /api/staff (staff:write)", () => {
    it("creates staff (admin)", async () => {
      mockPrisma.staff.create.mockResolvedValueOnce({
        id: "st-new", role: "Clerk", name: "Mr. D", email: null, contact: null, createdAt: new Date(),
      });
      const res = await post("/api/staff").send({ role: "Clerk", name: "Mr. D" });
      expect(res.status).toBe(201);
    });

    it("rejects missing fields (400)", async () => {
      const res = await post("/api/staff").send({ name: "X" });
      expect(res.status).toBe(400);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await post("/api/staff").send({ role: "Clerk", name: "X" });
      expect(res.status).toBe(403);
    });
  });

  describe("Staff — POST /api/staff/import (staff:write)", () => {
    it("imports batch of staff", async () => {
      mockPrisma.staff.createManyAndReturn.mockResolvedValueOnce([
        { id: "st1", name: "A", role: "Clerk" },
      ]);
      const res = await post("/api/staff/import").send({
        staff: [{ name: "A", role: "Clerk" }],
      });
      expect(res.status).toBe(201);
      expect(res.body.created).toBe(1);
    });

    it("rejects empty array (400)", async () => {
      const res = await post("/api/staff/import").send({ staff: [] });
      expect(res.status).toBe(400);
    });
  });

  describe("Staff — PUT /api/staff/:id (staff:write)", () => {
    it("updates staff (admin)", async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce({ photoPath: null });
      mockPrisma.staff.update.mockResolvedValueOnce({
        id: "st1", role: "Accountant", name: "Mr. C", email: null, contact: null, photoPath: null, createdAt: new Date(),
      });
      const res = await put("/api/staff/st1").send({ role: "Accountant" });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe("Accountant");
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await put("/api/staff/st1").send({ name: "X" });
      expect(res.status).toBe(403);
    });
  });

  describe("Staff — GET /api/staff/:id/photo (staff:read)", () => {
    it("returns 404 when no photo", async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce({ photo: null, photoPath: null });
      const res = await get("/api/staff/st1/photo");
      expect(res.status).toBe(404);
    });

    it("allows viewer (read-only)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      mockPrisma.staff.findUnique.mockResolvedValueOnce({ photo: null, photoPath: null });
      const res = await get("/api/staff/st1/photo");
      expect(res.status).toBe(404);
    });
  });

  // ── Books CRUD (ops) ──

  describe("Books — GET /api/books (books:read)", () => {
    it("returns books with pagination and class info", async () => {
      mockPrisma.book.findMany.mockResolvedValueOnce([
        { id: "b1", name: "Math Book", publication: "ABC", mrp: "100", discounted: "90", sell: "85", classId: "c1", class: { id: "c1", name: "One" } },
      ]);
      mockPrisma.book.count.mockResolvedValueOnce(1);
      const res = await get("/api/books");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it("allows viewer (read-only)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      mockPrisma.book.findMany.mockResolvedValueOnce([]);
      mockPrisma.book.count.mockResolvedValueOnce(0);
      const res = await get("/api/books");
      expect(res.status).toBe(200);
    });
  });

  describe("Books — POST /api/books (books:write)", () => {
    it("creates book (admin)", async () => {
      mockPrisma.schoolClass.findUnique.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440000", name: "One" });
      mockPrisma.book.create.mockResolvedValueOnce({
        id: "b-new", name: "Science Book", publication: "XYZ", mrp: "200", discounted: "180", sell: "170", classId: "550e8400-e29b-41d4-a716-446655440000",
        class: { id: "550e8400-e29b-41d4-a716-446655440000", name: "One" },
      });
      const res = await post("/api/books").send({
        name: "Science Book", mrp: 200, discounted: 180, sell: 170, classId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Science Book");
    });

    it("rejects invalid classId (400)", async () => {
      const res = await post("/api/books").send({
        name: "Book", mrp: 100, discounted: 90, sell: 85, classId: "bogus",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/ID/i);
    });

    it("returns 400 for missing name", async () => {
      const res = await post("/api/books").send({ mrp: 100, classId: "550e8400-e29b-41d4-a716-446655440000" });
      expect(res.status).toBe(400);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await post("/api/books").send({ name: "B", mrp: 10, discounted: 9, sell: 8, classId: "c1" });
      expect(res.status).toBe(403);
    });
  });

  describe("Books — PUT /api/books/:id (books:write)", () => {
    it("updates book (admin)", async () => {
      mockPrisma.book.update.mockResolvedValueOnce({
        id: "b1", name: "Math Updated", publication: "ABC", mrp: "110", discounted: "99", sell: "94",
        class: { id: "c1", name: "One" },
      });
      const res = await put("/api/books/b1").send({ name: "Math Updated", mrp: 110 });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Math Updated");
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await put("/api/books/b1").send({ name: "X" });
      expect(res.status).toBe(403);
    });
  });

  describe("Books — DELETE /api/books/:id (books:write)", () => {
    it("deletes book (admin)", async () => {
      mockPrisma.book.delete.mockResolvedValueOnce({ id: "b1" });
      const res = await del("/api/books/b1");
      expect(res.status).toBe(200);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await del("/api/books/b1");
      expect(res.status).toBe(403);
    });
  });

  // ── Students (additional routes) ──

  describe("Students — PUT /api/students/:id (students:write)", () => {
    it("updates student (admin)", async () => {
      mockPrisma.student.findUnique.mockResolvedValueOnce({ photoPath: null });
      mockPrisma.student.update.mockResolvedValueOnce({
        id: "s1", classId: "c1", class: "One", studentId: "S000001", roll: "1", session: "2026",
        name: "Alice Updated", fatherName: null, motherName: null, contact: null,
        photoPath: null, photo: null, graduatedAt: null, createdAt: new Date(),
      });
      const res = await put("/api/students/s1").send({ name: "Alice Updated" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Alice Updated");
    });

    it("returns 400 for invalid data", async () => {
      const res = await put("/api/students/s1").send({ name: "" });
      expect(res.status).toBe(400);
    });

    it("blocks accountant (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.accountant);
      const res = await put("/api/students/s1").send({ name: "X" });
      expect(res.status).toBe(403);
    });
  });

  describe("Students — POST /api/students/import (students:write)", () => {
    it("imports batch of students", async () => {
      mockPrisma.schoolClass.findMany.mockResolvedValueOnce([
        { id: "c1", name: "One" },
      ]);
      mockPrisma.student.aggregate.mockResolvedValueOnce({ _max: { studentId: "S000005" } });
      mockPrisma.student.createManyAndReturn.mockResolvedValueOnce([
        { id: "s-new", name: "Bob", class: "One", studentId: "S000006", roll: "1" },
      ]);
      const res = await post("/api/students/import").send({
        students: [{ name: "Bob", class: "One", roll: "1", session: "2026" }],
      });
      expect(res.status).toBe(201);
      expect(res.body.created).toBe(1);
    });

    it("rejects empty array (400)", async () => {
      const res = await post("/api/students/import").send({ students: [] });
      expect(res.status).toBe(400);
    });

    it("reports per-row errors for invalid entries", async () => {
      mockPrisma.schoolClass.findMany.mockResolvedValueOnce([{ id: "550e8400-e29b-41d4-a716-446655440000", name: "One" }]);
      mockPrisma.student.aggregate.mockResolvedValueOnce({ _max: { studentId: null } });
      mockPrisma.student.createManyAndReturn.mockResolvedValueOnce([
        { id: "s-new", name: "Valid", class: "One", studentId: "S000001", roll: null },
      ]);
      const res = await post("/api/students/import").send({
        students: [
          { name: "Valid", class: "One" },
          { name: "", class: "One" },
          { name: "NoClass" },
        ],
      });
      expect(res.status).toBe(201);
      expect(res.body.created).toBe(1);
      expect(res.body.errors).toHaveLength(2);
    });

    it("blocks accountant (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.accountant);
      const res = await post("/api/students/import").send({ students: [{ name: "X", class: "One" }] });
      expect(res.status).toBe(403);
    });
  });

  describe("Students — POST /api/students/:id/graduate (students:write)", () => {
    it("graduates a student", async () => {
      mockPrisma.student.update.mockResolvedValueOnce({ id: "s1", graduatedAt: new Date() });
      const res = await post("/api/students/s1/graduate");
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/graduated/i);
      expect(mockPrisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "s1" }, data: expect.objectContaining({ graduatedAt: expect.any(Date) }) })
      );
    });

    it("blocks viewer (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      const res = await post("/api/students/s1/graduate");
      expect(res.status).toBe(403);
    });
  });

  describe("Students — POST /api/students/:id/ungraduate (students:write)", () => {
    it("ungraduates a student", async () => {
      mockPrisma.student.update.mockResolvedValueOnce({ id: "s1", graduatedAt: null });
      const res = await post("/api/students/s1/ungraduate");
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/undone/i);
    });

    it("blocks viewer (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      const res = await post("/api/students/s1/ungraduate");
      expect(res.status).toBe(403);
    });
  });

  describe("Students — POST /api/classes/:classId/graduate (students:write)", () => {
    it("graduates entire class", async () => {
      mockPrisma.schoolClass.findUnique.mockReset().mockImplementation(() =>
        Promise.resolve({ id: "c1", name: "One" })
      );
      mockPrisma.student.updateMany.mockResolvedValue({ count: 5 });
      const res = await post("/api/classes/c1/graduate");
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/5 students/i);
    });

    it("returns 404 for missing class", async () => {
      mockPrisma.schoolClass.findUnique.mockResolvedValue(null);
      const res = await post("/api/classes/bogus/graduate");
      expect(res.status).toBe(404);
    });

    it("blocks viewer (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      const res = await post("/api/classes/c1/graduate");
      expect(res.status).toBe(403);
    });
  });

  describe("Students — GET /api/students/:id/photo (students:read)", () => {
    it("returns 404 when no photo", async () => {
      mockPrisma.student.findUnique.mockResolvedValueOnce({ photo: null, photoPath: null });
      const res = await get("/api/students/s1/photo");
      expect(res.status).toBe(404);
    });

    it("allows viewer (read-only)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      mockPrisma.student.findUnique.mockResolvedValueOnce({ photo: null, photoPath: null });
      const res = await get("/api/students/s1/photo");
      expect(res.status).toBe(404);
    });
  });

  // ── Period Close (Closure) ──

  describe("Period Close — GET /api/finance/period-closes (finance:read)", () => {
    it("returns period closes", async () => {
      mockPrisma.periodClose.findMany.mockResolvedValueOnce([
        { id: "pc1", fiscalYear: 2026, closedBy: "user-1", closedAt: new Date(), notes: null },
      ]);
      const res = await get("/api/finance/period-closes");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("allows viewer (read-only)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      mockPrisma.periodClose.findMany.mockResolvedValueOnce([]);
      const res = await get("/api/finance/period-closes");
      expect(res.status).toBe(200);
    });
  });

  describe("Period Close — POST /api/finance/period-closes (finance:admin)", () => {
    it("closes a fiscal year (admin)", async () => {
      mockPrisma.periodClose.findUnique.mockResolvedValueOnce(null);
      mockPrisma.periodClose.create.mockResolvedValueOnce({
        id: "pc-new", fiscalYear: 2026, closedBy: "user-1", closedAt: new Date(), notes: null,
      });
      const res = await post("/api/finance/period-closes").send({ fiscalYear: 2026 });
      expect(res.status).toBe(201);
      expect(res.body.fiscalYear).toBe(2026);
    });

    it("rejects missing fiscalYear (400)", async () => {
      const res = await post("/api/finance/period-closes").send({});
      expect(res.status).toBe(400);
    });

    it("rejects already closed (409)", async () => {
      mockPrisma.periodClose.findUnique.mockResolvedValueOnce({ id: "pc1", fiscalYear: 2026 });
      const res = await post("/api/finance/period-closes").send({ fiscalYear: 2026 });
      expect(res.status).toBe(409);
    });

    it("blocks accountant (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.accountant);
      const res = await post("/api/finance/period-closes").send({ fiscalYear: 2026 });
      expect(res.status).toBe(403);
    });
  });

  describe("Period Close — DELETE /api/finance/period-closes/:fiscalYear (finance:admin)", () => {
    it("reopens a closed fiscal year (admin)", async () => {
      mockPrisma.periodClose.findUnique.mockResolvedValueOnce({ id: "pc1", fiscalYear: 2026 });
      mockPrisma.periodClose.delete.mockResolvedValueOnce({ id: "pc1" });
      const res = await del("/api/finance/period-closes/2026");
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/reopened/i);
    });

    it("rejects invalid fiscal year (400)", async () => {
      const res = await del("/api/finance/period-closes/abc");
      expect(res.status).toBe(400);
    });

    it("returns 404 for non-closed year", async () => {
      mockPrisma.periodClose.findUnique.mockResolvedValueOnce(null);
      const res = await del("/api/finance/period-closes/2099");
      expect(res.status).toBe(404);
    });

    it("blocks accountant (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.accountant);
      const res = await del("/api/finance/period-closes/2026");
      expect(res.status).toBe(403);
    });
  });

  // ── Reconciliations ──

  describe("Reconciliations — GET /api/finance/reconciliations (finance:read)", () => {
    it("returns reconciliations unpaginated", async () => {
      mockPrisma.reconciliation.findMany.mockResolvedValueOnce([
        { id: "rec1", account: "AL_RAWA_BANK", statementDate: new Date(), closingBalance: 50000, systemBalance: 50000, difference: 0, status: "reconciled", createdAt: new Date(), createdBy: "user-1" },
      ]);
      const res = await get("/api/finance/reconciliations");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("filters by account query param", async () => {
      mockPrisma.reconciliation.findMany.mockResolvedValueOnce([]);
      const res = await get("/api/finance/reconciliations?account=CASH_IN_HAND");
      expect(res.status).toBe(200);
      expect(mockPrisma.reconciliation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { account: "CASH_IN_HAND" } })
      );
    });

    it("supports pagination", async () => {
      mockPrisma.reconciliation.findMany.mockResolvedValueOnce([]);
      mockPrisma.reconciliation.count.mockResolvedValueOnce(5);
      const res = await get("/api/finance/reconciliations?page=1&limit=10");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("page");
    });

    it("allows viewer (read-only)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      mockPrisma.reconciliation.findMany.mockResolvedValueOnce([]);
      const res = await get("/api/finance/reconciliations");
      expect(res.status).toBe(200);
    });
  });

  describe("Reconciliations — POST /api/finance/reconciliations (finance:admin)", () => {
    it("creates reconciliation (admin)", async () => {
      mockPrisma.openingBalance.findUnique.mockResolvedValueOnce({ id: "ob1", fiscalYear: 2026, account: "AL_RAWA_BANK", amount: 10000 });
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ net: "40000" }]);
      mockPrisma.reconciliation.create.mockResolvedValueOnce({
        id: "rec-new", account: "AL_RAWA_BANK", statementDate: new Date(), closingBalance: 50000,
        systemBalance: 50000, difference: 0, status: "reconciled",
      });
      const res = await post("/api/finance/reconciliations").send({
        account: "AL_RAWA_BANK", statementDate: "2026-05-01", closingBalance: 50000,
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("reconciled");
    });

    it("returns 400 for missing fields", async () => {
      const res = await post("/api/finance/reconciliations").send({ account: "AL_RAWA_BANK" });
      expect(res.status).toBe(400);
    });

    it("blocks accountant (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.accountant);
      const res = await post("/api/finance/reconciliations").send({
        account: "AL_RAWA_BANK", statementDate: "2026-05-01", closingBalance: 50000,
      });
      expect(res.status).toBe(403);
    });
  });

  // ── Fee Schedule — Copy From Year ──

  describe("FeeSchedule — POST /api/finance/fee-schedules/copy-from-year (finance:write)", () => {
    const sourceSchedule = { id: "fs1", academicYearId: "ay-2025", classId: "c1", category: "Tuition Fee", amount: 1000, frequency: "MONTHLY", applicability: "AUTO", effectiveFrom: null, effectiveTo: null };

    it("copies fee schedules from source to target year", async () => {
      let findManyCalls = 0;
      mockPrisma.feeSchedule.findMany.mockImplementation(() => {
        findManyCalls++;
        return findManyCalls === 1
          ? Promise.resolve([sourceSchedule])
          : Promise.resolve([]);
      });
      mockPrisma.feeSchedule.createMany.mockResolvedValue({ count: 1 });
      const res = await post("/api/finance/fee-schedules/copy-from-year").send({
        sourceAcademicYearId: "ay-2025", targetAcademicYearId: "ay-2026",
      });
      expect(res.status).toBe(200);
      expect(res.body.copied).toBe(1);
    });

    it("returns 400 when ids missing", async () => {
      const res = await post("/api/finance/fee-schedules/copy-from-year").send({ sourceAcademicYearId: "ay-2025" });
      expect(res.status).toBe(400);
    });

    it("returns 404 when source has no schedules", async () => {
      mockPrisma.feeSchedule.findMany.mockResolvedValue([]);
      const res = await post("/api/finance/fee-schedules/copy-from-year").send({
        sourceAcademicYearId: "ay-empty", targetAcademicYearId: "ay-2026",
      });
      expect(res.status).toBe(404);
    });

    it("blocks viewer (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      const res = await post("/api/finance/fee-schedules/copy-from-year").send({
        sourceAcademicYearId: "ay-1", targetAcademicYearId: "ay-2",
      });
      expect(res.status).toBe(403);
    });
  });

  // ── Settings ──

  describe("Settings — GET /api/settings", () => {
    it("returns settings with defaults", async () => {
      mockPrisma.schoolSetting.findMany.mockResolvedValueOnce([
        { id: "s1", key: "school_name", value: "My School" },
      ]);
      const res = await get("/api/settings");
      expect(res.status).toBe(200);
      expect(res.body.school_name).toBe("My School");
      expect(res.body.address).toBe("");
    });

    it("allows viewer", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      mockPrisma.schoolSetting.findMany.mockResolvedValueOnce([]);
      const res = await get("/api/settings");
      expect(res.status).toBe(200);
    });
  });

  describe("Settings — PUT /api/settings (finance:admin)", () => {
    it("updates settings (admin)", async () => {
      mockPrisma.$transaction.mockImplementationOnce((entries: any[]) => {
        if (Array.isArray(entries)) return Promise.all(entries);
        return Promise.resolve([]);
      });
      mockPrisma.schoolSetting.findMany.mockResolvedValueOnce([
        { id: "s1", key: "school_name", value: "Updated School" },
      ]);
      const res = await put("/api/settings").send({ school_name: "Updated School" });
      expect(res.status).toBe(200);
      expect(res.body.school_name).toBe("Updated School");
    });

    it("ignores unknown keys", async () => {
      mockPrisma.$transaction.mockImplementationOnce((entries: any[]) => Promise.all(entries));
      mockPrisma.schoolSetting.findMany.mockResolvedValueOnce([]);
      const res = await put("/api/settings").send({ unknown_key: "value" });
      expect(res.status).toBe(200);
    });

    it("blocks viewer (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.viewer);
      const res = await put("/api/settings").send({ school_name: "X" });
      expect(res.status).toBe(403);
    });
  });

  // ── Users (additional routes) ──

  describe("Users — GET /api/users/roles (users:read)", () => {
    it("returns role list", async () => {
      const res = await get("/api/users/roles");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await get("/api/users/roles");
      expect(res.status).toBe(403);
    });
  });

  describe("Users — PUT /api/users/:id/role (users:write)", () => {
    it("updates user role (admin)", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "other-user", name: "Other" });
      mockPrisma.user.update.mockResolvedValueOnce({
        id: "other-user", name: "Other", email: "other@test.com", role: "teacher", emailVerified: true, createdAt: new Date(),
      });
      const res = await put("/api/users/other-user/role").send({ role: "teacher" });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe("teacher");
    });

    it("rejects invalid role (400)", async () => {
      const res = await put("/api/users/user-1/role").send({ role: "superadmin" });
      expect(res.status).toBe(400);
    });

    it("rejects changing own role (400)", async () => {
      const res = await put("/api/users/user-admin/role").send({ role: "teacher" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/own/i);
    });

    it("returns 404 for non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const res = await put("/api/users/nonexistent/role").send({ role: "teacher" });
      expect(res.status).toBe(404);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await put("/api/users/other/role").send({ role: "viewer" });
      expect(res.status).toBe(403);
    });
  });

  describe("Users — DELETE /api/users/:id (users:write)", () => {
    it("deletes user (admin)", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "other-user", name: "Other" });
      const res = await del("/api/users/other-user");
      expect(res.status).toBe(200);
    });

    it("rejects self-deletion (400)", async () => {
      const res = await del("/api/users/user-admin");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/own/i);
    });

    it("returns 404 for non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const res = await del("/api/users/nonexistent");
      expect(res.status).toBe(404);
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await del("/api/users/other");
      expect(res.status).toBe(403);
    });
  });

  // ── Audit (additional routes) ──

  describe("Audit — GET /api/audit/actions (audit:read)", () => {
    it("returns grouped audit actions", async () => {
      mockPrisma.auditLog.groupBy.mockResolvedValueOnce([
        { action: "CREATE", _count: { action: 10 } },
        { action: "UPDATE", _count: { action: 5 } },
      ]);
      const res = await get("/api/audit/actions");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].action).toBe("CREATE");
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await get("/api/audit/actions");
      expect(res.status).toBe(403);
    });
  });

  describe("Audit — GET /api/audit/entity-types (audit:read)", () => {
    it("returns grouped entity types", async () => {
      mockPrisma.auditLog.groupBy.mockResolvedValueOnce([
        { entityType: "Student", _count: { entityType: 20 } },
      ]);
      const res = await get("/api/audit/entity-types");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].entityType).toBe("Student");
    });

    it("blocks teacher (403)", async () => {
      mockGetUser.mockResolvedValueOnce(users.teacher);
      const res = await get("/api/audit/entity-types");
      expect(res.status).toBe(403);
    });
  });

  // ── Wake DB ──

  describe("Wake DB — GET /api/wake-db", () => {
    it("returns status ok", async () => {
      const res = await get("/api/wake-db");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });
});
