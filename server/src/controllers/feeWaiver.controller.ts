import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import { param } from "../lib/param.js";

export const getFeeWaivers = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, feeScheduleId, active } = req.query;
    const where: any = {};
    if (studentId) where.studentId = String(studentId);
    if (feeScheduleId) where.feeScheduleId = String(feeScheduleId);
    if (active !== undefined) where.active = active === "true";

    const waivers = await prisma.feeWaiver.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, class: true, roll: true } },
        feeSchedule: { select: { id: true, category: true, amount: true, frequency: true, classRel: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(waivers);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
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

    logAudit({ userId: req.session?.user?.id, action: "CREATE", entityType: "FeeWaiver", entityId: waiver.id, details: JSON.stringify({ studentId, feeScheduleId, value }) });
    res.status(201).json(waiver);
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
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
    logAudit({ userId: req.session?.user?.id, action: "DEACTIVATE", entityType: "FeeWaiver", entityId: id });
    res.json(waiver);
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};
