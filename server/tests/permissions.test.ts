import { describe, it, expect } from "vitest";
import {
  hasPermission,
  getRolePermissions,
  ROLE_LABELS,
  ALL_ROLES,
} from "../src/lib/permissions.js";

describe("ROLE_LABELS", () => {
  it("maps each role to a display label", () => {
    expect(ROLE_LABELS.admin).toBe("Admin");
    expect(ROLE_LABELS.teacher).toBe("Teacher");
    expect(ROLE_LABELS.accountant).toBe("Accountant");
    expect(ROLE_LABELS.viewer).toBe("Viewer");
  });
});

describe("ALL_ROLES", () => {
  it("contains exactly four roles", () => {
    expect(ALL_ROLES).toEqual(["admin", "teacher", "accountant", "viewer"]);
  });
});

describe("hasPermission", () => {
  it("returns true for admin on any permission", () => {
    expect(hasPermission("admin", "finance:admin")).toBe(true);
    expect(hasPermission("admin", "audit:read")).toBe(true);
    expect(hasPermission("admin", "users:write")).toBe(true);
  });

  it("returns true for teacher on teacher permissions", () => {
    expect(hasPermission("teacher", "students:write")).toBe(true);
    expect(hasPermission("teacher", "results:write")).toBe(true);
  });

  it("returns false for teacher on finance permissions", () => {
    expect(hasPermission("teacher", "finance:read")).toBe(false);
    expect(hasPermission("teacher", "finance:admin")).toBe(false);
  });

  it("returns true for accountant on finance:read and finance:write", () => {
    expect(hasPermission("accountant", "finance:read")).toBe(true);
    expect(hasPermission("accountant", "finance:write")).toBe(true);
  });

  it("returns false for accountant on finance:admin", () => {
    expect(hasPermission("accountant", "finance:admin")).toBe(false);
  });

  it("returns true for viewer on read-only permissions", () => {
    expect(hasPermission("viewer", "students:read")).toBe(true);
    expect(hasPermission("viewer", "books:read")).toBe(true);
  });

  it("returns false for viewer on write permissions", () => {
    expect(hasPermission("viewer", "students:write")).toBe(false);
    expect(hasPermission("viewer", "finance:write")).toBe(false);
  });

  it("returns false for unknown role", () => {
    expect(hasPermission("superadmin", "students:read")).toBe(false);
  });

  it("returns false for empty string role", () => {
    expect(hasPermission("", "students:read")).toBe(false);
  });
});

describe("getRolePermissions", () => {
  it("returns all permissions for admin", () => {
    const perms = getRolePermissions("admin");
    expect(perms).toContain("finance:admin");
    expect(perms).toContain("audit:read");
    expect(perms).toContain("users:write");
    expect(perms).toHaveLength(24);
  });

  it("returns restricted set for viewer", () => {
    const perms = getRolePermissions("viewer");
    expect(perms).not.toContain("finance:write");
    expect(perms).not.toContain("students:write");
    expect(perms).toContain("students:read");
  });

  it("returns empty array for unknown role", () => {
    expect(getRolePermissions("unknown")).toEqual([]);
  });
});
