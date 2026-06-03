import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockCreateUser = vi.hoisted(() => vi.fn());
const mockUpdateUserById = vi.hoisted(() => vi.fn());
const mockDeleteUser = vi.hoisted(() => vi.fn());
const mockGenerateLink = vi.hoisted(() => vi.fn());
const mockFindUnique = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      admin: {
        createUser: mockCreateUser,
        updateUserById: mockUpdateUserById,
        deleteUser: mockDeleteUser,
        generateLink: mockGenerateLink,
      },
    },
  }))
);

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.APP_URL = "http://localhost:5173";
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      create: mockCreate,
      upsert: mockUpsert,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

vi.mock("../src/lib/email.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

import {
  getUserFromToken,
  createAdminUser,
  generateAndSendVerification,
  updateUserRole,
  deleteAuthUser,
} from "../src/lib/supabase-auth.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUserFromToken", () => {
  it("returns null when supabase auth fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });
    const result = await getUserFromToken("bad-token");
    expect(result).toBeNull();
  });

  it("returns existing DB user when found", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", email: "test@test.com", email_confirmed_at: "2026-01-01" } },
      error: null,
    });
    mockFindUnique.mockResolvedValue({
      id: "u1",
      name: "Existing",
      email: "test@test.com",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await getUserFromToken("valid-token");
    expect(result?.id).toBe("u1");
    expect(result?.role).toBe("admin");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates a new DB user when not found in DB", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "u2",
          email: "new@test.com",
          email_confirmed_at: null,
          user_metadata: { name: "New User" },
        },
      },
      error: null,
    });
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "u2",
      name: "New User",
      email: "new@test.com",
      role: "viewer",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await getUserFromToken("valid-token");
    expect(result?.id).toBe("u2");
    expect(result?.role).toBe("viewer");
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        id: "u2",
        name: "New User",
        email: "new@test.com",
        role: "viewer",
        emailVerified: false,
      },
    });
  });

  it("derives name from email when metadata is absent", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u3", email: "john@test.com", email_confirmed_at: null, user_metadata: {} } },
      error: null,
    });
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "u3", name: "john", email: "john@test.com", role: "viewer", createdAt: new Date(), updatedAt: new Date() });

    await getUserFromToken("token");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "john" }),
      })
    );
  });
});

describe("createAdminUser", () => {
  it("creates user in supabase and upserts in DB", async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: { id: "au1" } },
      error: null,
    });
    mockUpsert.mockResolvedValue({});

    const result = await createAdminUser("admin@test.com", "pass123", "Admin");

    expect(mockCreateUser).toHaveBeenCalledWith({
      email: "admin@test.com",
      password: "pass123",
      email_confirm: false,
      user_metadata: { name: "Admin" },
    });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { id: "au1" },
      update: { name: "Admin", email: "admin@test.com", role: "admin", emailVerified: false },
      create: { id: "au1", name: "Admin", email: "admin@test.com", role: "admin", emailVerified: false },
    });
    expect(result?.id).toBe("au1");
  });

  it("throws when supabase creation errors", async () => {
    mockCreateUser.mockResolvedValue({ data: { user: null }, error: new Error("email taken") });
    await expect(createAdminUser("x@x.com", "pass", "X")).rejects.toThrow("email taken");
  });
});

describe("generateAndSendVerification", () => {
  it("generates link and sends email", async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { action_link: "https://verify.link" } },
      error: null,
    });

    const link = await generateAndSendVerification("user@test.com", "pass");
    expect(link).toBe("https://verify.link");
    expect(mockGenerateLink).toHaveBeenCalledWith({
      type: "signup",
      email: "user@test.com",
      password: "pass",
      options: { redirectTo: "http://localhost:5173/verify-email" },
    });
  });

  it("throws when supabase generateLink errors", async () => {
    mockGenerateLink.mockResolvedValue({ data: null, error: new Error("fail") });
    await expect(generateAndSendVerification("x@x.com", "p")).rejects.toThrow("fail");
  });

  it("throws when no link returned", async () => {
    mockGenerateLink.mockResolvedValue({ data: { properties: {} }, error: null });
    await expect(generateAndSendVerification("x@x.com", "p")).rejects.toThrow("No verification link returned");
  });
});

describe("updateUserRole", () => {
  it("updates role in supabase and DB", async () => {
    mockUpdateUserById.mockResolvedValue({ data: {}, error: null });
    mockUpdate.mockResolvedValue({});

    await updateUserRole("u1", "teacher");

    expect(mockUpdateUserById).toHaveBeenCalledWith("u1", { user_metadata: { role: "teacher" } });
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "teacher" } });
  });
});

describe("deleteAuthUser", () => {
  it("deletes from supabase and DB", async () => {
    mockDeleteUser.mockResolvedValue({ data: {}, error: null });
    mockDelete.mockResolvedValue({});

    await deleteAuthUser("u1");
    expect(mockDeleteUser).toHaveBeenCalledWith("u1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "u1" } });
  });

  it("still deletes DB record when supabase delete fails", async () => {
    mockDeleteUser.mockResolvedValue({ data: null, error: { message: "not found" } });
    mockDelete.mockResolvedValue({});

    await expect(deleteAuthUser("u1")).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "u1" } });
  });
});
