import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import { param } from "../lib/param.js";

const VALID_TYPES = ["FULL", "PERCENTAGE", "FIXED_AMOUNT", "CUSTOM_AMOUNT"];

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
    const { studentId, feeScheduleId, type, value, reason, approvedBy, startsAt, endsAt } = req.body;
    if (!studentId || !feeScheduleId || !type || value == null) {
      return res.status(400).json({ error: "studentId, feeScheduleId, type, and value are required" });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` });
    }

    const waiver = await prisma.feeWaiver.upsert({
      where: { studentId_feeScheduleId: { studentId, feeScheduleId } },
      update: { type, value: Number(value), reason, approvedBy, active: true, startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null },
      create: { studentId, feeScheduleId, type, value: Number(value), reason, approvedBy, startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null },
    });

    logAudit({ userId: req.session?.user?.id, action: "CREATE", entityType: "FeeWaiver", entityId: waiver.id, details: JSON.stringify({ studentId, feeScheduleId, type, value }) });
    res.status(201).json(waiver);
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};

export const updateFeeWaiver = async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const { type, value, reason, approvedBy, active, startsAt, endsAt } = req.body;
    const data: any = {};
    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` });
      data.type = type;
    }
    if (value !== undefined) data.value = Number(value);
    if (reason !== undefined) data.reason = reason;
    if (approvedBy !== undefined) data.approvedBy = approvedBy;
    if (active !== undefined) data.active = active;
    if (startsAt !== undefined) data.startsAt = startsAt ? new Date(startsAt) : null;
    if (endsAt !== undefined) data.endsAt = endsAt ? new Date(endsAt) : null;

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
