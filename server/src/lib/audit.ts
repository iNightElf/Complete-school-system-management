import { prisma } from "./prisma.js";

export async function logAudit(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: string | null;
}) {
  try {
    await prisma.auditLog.create({ data: params });
  } catch (err: any) {
    console.error("[logAudit] Failed to write audit log:", err?.message || err);
  }
}
