import { uploadPhoto, type UploadResult } from "./supabase.js";
import { prisma } from "./prisma.js";

const setPhotoPath: Record<string, (id: string, path: string) => Promise<unknown>> = {
  students: (id, path) => prisma.student.update({ where: { id }, data: { photoPath: path } }),
  teachers: (id, path) => prisma.teacher.update({ where: { id }, data: { photoPath: path } }),
  staff: (id, path) => prisma.staff.update({ where: { id }, data: { photoPath: path } }),
};

export function uploadPhotoAsync(
  bucket: string,
  entityType: "students" | "teachers" | "staff",
  entityId: string,
  buffer: Buffer,
  mimeType: string,
): void {
  uploadPhoto(bucket, entityType, entityId, buffer, mimeType)
    .then(({ path, error }: UploadResult) => {
      if (error || !path) {
        console.error(`[queue] Photo upload failed for ${entityType}/${entityId}: ${error}`);
        return;
      }
      setPhotoPath[entityType]?.(entityId, path).catch((e: unknown) =>
        console.error(`[queue] Failed to update ${entityType} photoPath:`, e)
      );
    })
    .catch((e: unknown) => console.error(`[queue] Photo upload error for ${entityType}/${entityId}:`, e));
}
