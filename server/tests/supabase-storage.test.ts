import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpload = vi.hoisted(() => vi.fn());
const mockRemove = vi.hoisted(() => vi.fn());
const mockCreateSignedUrl = vi.hoisted(() => vi.fn());
const mockGetPublicUrl = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn(() => ({
  upload: mockUpload,
  remove: mockRemove,
  createSignedUrl: mockCreateSignedUrl,
  getPublicUrl: mockGetPublicUrl,
})));
const mockCreateClient = vi.hoisted(() => vi.fn(() => ({
  storage: { from: mockFrom },
})));

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

import {
  uploadPhoto,
  deletePhoto,
  getSignedUrl,
  getPhotoUrl,
  getPublicUrl,
} from "../src/lib/supabase.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("uploadPhoto", () => {
  it("uploads and returns path on success", async () => {
    mockUpload.mockResolvedValue({ error: null });

    const result = await uploadPhoto("photos", "teachers", "t1", Buffer.from("data"), "image/jpeg");
    expect(result).toEqual({ path: "teachers/t1.jpg", error: null });
    expect(mockUpload).toHaveBeenCalledWith("teachers/t1.jpg", Buffer.from("data"), {
      contentType: "image/jpeg",
      upsert: true,
    });
  });

  it("uses png extension for PNG mime type", async () => {
    mockUpload.mockResolvedValue({ error: null });

    const result = await uploadPhoto("photos", "students", "s1", Buffer.from("png-data"), "image/png");
    expect(result).toEqual({ path: "students/s1.png", error: null });
  });

  it("returns error when supabase upload fails", async () => {
    mockUpload.mockResolvedValue({ error: { message: "Storage quota exceeded" } });

    const result = await uploadPhoto("photos", "students", "s1", Buffer.from("data"), "image/jpeg");
    expect(result).toEqual({ path: null, error: "Storage quota exceeded" });
  });
});

describe("deletePhoto", () => {
  it("calls remove on success", async () => {
    mockRemove.mockResolvedValue({ error: null });

    await deletePhoto("photos", "students/s1.jpg");
    expect(mockRemove).toHaveBeenCalledWith(["students/s1.jpg"]);
  });
});

describe("getSignedUrl", () => {
  it("returns signed URL on success", async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.url" }, error: null });

    const url = await getSignedUrl("photos", "students/s1.jpg");
    expect(url).toBe("https://signed.url");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("students/s1.jpg", 86400);
  });

  it("returns null when createSignedUrl errors", async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: "not found" } });

    const url = await getSignedUrl("photos", "missing.jpg");
    expect(url).toBeNull();
  });
});

describe("getPhotoUrl", () => {
  it("returns null when path is empty", async () => {
    expect(await getPhotoUrl("photos", "")).toBeNull();
    expect(await getPhotoUrl("photos", null as any)).toBeNull();
  });

  it("returns cached URL when available and not expired", async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.url" }, error: null });

    const url1 = await getPhotoUrl("photos", "path.jpg");
    expect(url1).toBe("https://signed.url");

    const url2 = await getPhotoUrl("photos", "path.jpg");
    expect(url2).toBe("https://signed.url");
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("returns null when createSignedUrl fails", async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: new Error("fail") });

    expect(await getPhotoUrl("photos", "missing-file.jpg")).toBeNull();
  });
});

describe("getPublicUrl", () => {
  it("returns null when path is empty", () => {
    expect(getPublicUrl("photos", "")).toBeNull();
  });

  it("returns public URL on success", () => {
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://public.url/path.jpg" } });

    const url = getPublicUrl("photos", "path.jpg");
    expect(url).toBe("https://public.url/path.jpg");
  });
});

describe("unconfigured supabase (no env vars)", () => {
  it("uploadPhoto returns error when supabase is not configured", async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { uploadPhoto: unconfUpload } = await import("../src/lib/supabase.js");
    const result = await unconfUpload("photos", "students", "s1", Buffer.from("data"), "image/jpeg");
    expect(result).toEqual({ path: null, error: "Supabase not configured" });
  });

  it("deletePhoto does nothing when supabase is not configured", async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { deletePhoto: unconfDelete } = await import("../src/lib/supabase.js");
    await expect(unconfDelete("photos", "some/path")).resolves.toBeUndefined();
  });

  it("getSignedUrl returns null when not configured", async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { getSignedUrl: unconfSigned } = await import("../src/lib/supabase.js");
    const url = await unconfSigned("photos", "path");
    expect(url).toBeNull();
  });

  it("getPhotoUrl returns null when not configured", async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { getPhotoUrl: unconfPhoto } = await import("../src/lib/supabase.js");
    expect(await unconfPhoto("photos", "path")).toBeNull();
  });

  it("getPublicUrl returns null when not configured", async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { getPublicUrl: unconfPublic } = await import("../src/lib/supabase.js");
    expect(unconfPublic("photos", "path")).toBeNull();
  });
});
