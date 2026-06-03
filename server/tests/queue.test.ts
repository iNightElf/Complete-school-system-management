import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUploadPhoto = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/supabase.js", () => ({
  uploadPhoto: mockUploadPhoto,
}));

const mockStudentUpdate = vi.hoisted(() => vi.fn());
const mockTeacherUpdate = vi.hoisted(() => vi.fn());
const mockStaffUpdate = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    student: { update: mockStudentUpdate },
    teacher: { update: mockTeacherUpdate },
    staff: { update: mockStaffUpdate },
  },
}));

import { uploadPhotoAsync } from "../src/lib/queue.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("uploadPhotoAsync", () => {
  it("uploads and updates student photoPath on success", async () => {
    mockUploadPhoto.mockResolvedValue({ path: "students/s1.jpg", error: null });
    mockStudentUpdate.mockResolvedValue({});

    uploadPhotoAsync("photos", "students", "s1", Buffer.from("data"), "image/jpeg");

    await vi.waitFor(() => {
      expect(mockUploadPhoto).toHaveBeenCalledWith("photos", "students", "s1", Buffer.from("data"), "image/jpeg");
      expect(mockStudentUpdate).toHaveBeenCalledWith({ where: { id: "s1" }, data: { photoPath: "students/s1.jpg" } });
    });
  });

  it("uploads and updates teacher photoPath on success", async () => {
    mockUploadPhoto.mockResolvedValue({ path: "teachers/t1.jpg", error: null });
    mockTeacherUpdate.mockResolvedValue({});

    uploadPhotoAsync("photos", "teachers", "t1", Buffer.from("data"), "image/jpeg");

    await vi.waitFor(() => {
      expect(mockTeacherUpdate).toHaveBeenCalledWith({ where: { id: "t1" }, data: { photoPath: "teachers/t1.jpg" } });
    });
  });

  it("uploads and updates staff photoPath on success", async () => {
    mockUploadPhoto.mockResolvedValue({ path: "staff/st1.jpg", error: null });
    mockStaffUpdate.mockResolvedValue({});

    uploadPhotoAsync("photos", "staff", "st1", Buffer.from("data"), "image/jpeg");

    await vi.waitFor(() => {
      expect(mockStaffUpdate).toHaveBeenCalledWith({ where: { id: "st1" }, data: { photoPath: "staff/st1.jpg" } });
    });
  });

  it("logs error when upload fails and does not update DB", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUploadPhoto.mockResolvedValue({ path: null, error: "Upload failed" });

    uploadPhotoAsync("photos", "students", "s1", Buffer.from("data"), "image/jpeg");

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "[queue] Photo upload failed for students/s1: Upload failed"
      );
    });
    expect(mockStudentUpdate).not.toHaveBeenCalled();
  });

  it("logs error when upload promise rejects", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUploadPhoto.mockRejectedValue(new Error("Network error"));

    uploadPhotoAsync("photos", "students", "s1", Buffer.from("data"), "image/jpeg");

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[queue] Photo upload error for students/s1:"),
        expect.any(Error),
      );
    });
  });

  it("logs error when DB update fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUploadPhoto.mockResolvedValue({ path: "students/s1.jpg", error: null });
    mockStudentUpdate.mockRejectedValue(new Error("DB error"));

    uploadPhotoAsync("photos", "students", "s1", Buffer.from("data"), "image/jpeg");

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[queue] Failed to update students photoPath:"),
        expect.any(Error),
      );
    });
  });
});
