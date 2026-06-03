import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError, errorStatus, handleControllerError } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import { param } from "../lib/param.js";

export const getFeeWaivers = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, feeScheduleId, active, page: pageStr, limit: limitStr } = req.query;
    const where: any = {};
    if (studentId) where.studentId = String(studentId);
    if (feeScheduleId) where.feeScheduleId = String(feeScheduleId);
    if (active !== undefined) where.active = active === "true";

    const page = pageStr ? Math.max(1, parseInt(String(pageStr), 10) || 1) : undefined;
    const limit = page ? Math.min(200, Math.max(1, parseInt(String(limitStr || '50'), 10) || 50)) : undefined;

    if (page) {
      const [waivers, total] = await Promise.all([
        prisma.feeWaiver.findMany({
          where,
          include: {
            student: { select: { id: true, name: true, class: true, studentId: true } },
            feeSchedule: { select: { id: true, category: true, amount: true, frequency: true, classRel: { select: { name: true } } } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit!,
          take: limit!,
        }),
        prisma.feeWaiver.count({ where }),
      ]);
      return res.json({ data: waivers, total, page, totalPages: Math.ceil(total / limit!) });
    }
    const waivers = await prisma.feeWaiver.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, class: true, studentId: true } },
        feeSchedule: { select: { id: true, category: true, amount: true, frequency: true, classRel: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    res.json(waivers);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const createFeeWaiver = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, feeScheduleId, value, reason, approvedBy } = req.body;
    if (!studentId || !feeScheduleId || value == null) {
      return res.status(400).json({ error: "studentId, feeScheduleId, and value (expected amount) are required" });
    }

    // Immutable: deactivate any existing active waiver for this student+schedule, then create a new record
    await prisma.feeWaiver.updateMany({
      where: { studentId, feeScheduleId, active: true },
      data: { active: false },
    });

    const waiver = await prisma.feeWaiver.create({
      data: { studentId, feeScheduleId, type: "CUSTOM_AMOUNT", value: Number(value), reason, approvedBy },
    });

    logAudit({ userId: req.user?.id, action: "CREATE", entityType: "FeeWaiver", entityId: waiver.id, details: JSON.stringify({ studentId, feeScheduleId, value }) });
    res.status(201).json(waiver);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const updateFeeWaiver = async (req: AuthRequest, res: Response) => {
  // Immutable: update is forbidden — use deactivate + create instead
  res.status(400).json({ error: "Direct update not allowed. Deactivate and create a new waiver instead." });
  return;
};

export const deactivateFeeWaiver = async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const waiver = await prisma.feeWaiver.update({ where: { id }, data: { active: false } });
    logAudit({ userId: req.user?.id, action: "DEACTIVATE", entityType: "FeeWaiver", entityId: id });
    res.json(waiver);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};
