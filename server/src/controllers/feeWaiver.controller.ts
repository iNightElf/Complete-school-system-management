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

    const waiver = await prisma.feeWaiver.upsert({
      where: { studentId_feeScheduleId: { studentId, feeScheduleId } },
      update: { type: "CUSTOM_AMOUNT", value: Number(value), reason, approvedBy, active: true },
      create: { studentId, feeScheduleId, type: "CUSTOM_AMOUNT", value: Number(value), reason, approvedBy },
    });

    logAudit({ userId: req.session?.user?.id, action: "CREATE", entityType: "FeeWaiver", entityId: waiver.id, details: JSON.stringify({ studentId, feeScheduleId, value }) });
    res.status(201).json(waiver);
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};

export const updateFeeWaiver = async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const { value, reason, approvedBy, active } = req.body;
    const data: any = { type: "CUSTOM_AMOUNT" };
    if (value !== undefined) data.value = Number(value);
    if (reason !== undefined) data.reason = reason;
    if (approvedBy !== undefined) data.approvedBy = approvedBy;
    if (active !== undefined) data.active = active;

    const waiver = await prisma.feeWaiver.update({ where: { id }, data });
    logAudit({ userId: req.session?.user?.id, action: "UPDATE", entityType: "FeeWaiver", entityId: id, details: JSON.stringify(data) });
    res.json(waiver);
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
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
