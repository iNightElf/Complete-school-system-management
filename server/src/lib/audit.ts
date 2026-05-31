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
  } catch {
    // Don't let audit logging break the main operation
  }
}
