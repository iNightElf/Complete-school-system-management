import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    auditLog: { create: mockCreate },
  },
}));

import { logAudit } from "../src/lib/audit.js";

describe("logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an audit log entry with all fields", async () => {
    mockCreate.mockResolvedValue({});
    await logAudit({
      userId: "user-1",
      action: "CREATE",
      entityType: "Student",
      entityId: "stu-1",
      details: "Created new student record",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        action: "CREATE",
        entityType: "Student",
        entityId: "stu-1",
        details: "Created new student record",
      },
    });
  });

  it("works with null userId and entityId", async () => {
    mockCreate.mockResolvedValue({});
    await logAudit({
      userId: null,
      action: "LOGIN",
      entityType: "Session",
      entityId: null,
      details: null,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: null,
        action: "LOGIN",
        entityType: "Session",
        entityId: null,
        details: null,
      },
    });
  });

  it("does not throw when prisma.create fails", async () => {
    mockCreate.mockRejectedValue(new Error("DB connection lost"));
    await expect(
      logAudit({ userId: "u1", action: "FAIL", entityType: "Test" })
    ).resolves.toBeUndefined();
  });
});
