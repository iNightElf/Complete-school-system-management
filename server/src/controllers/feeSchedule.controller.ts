import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import { param } from "../lib/param.js";

const VALID_FREQUENCIES = ["MONTHLY", "YEARLY", "ONETIME"];

export const getFeeSchedules = async (req: Request, res: Response) => {
  try {
    const { academicYearId, classId } = req.query;
    const where: any = {};
    if (academicYearId) where.academicYearId = String(academicYearId);
    if (classId) where.classId = String(classId);
    const schedules = await prisma.feeSchedule.findMany({
      where,
      include: { academicYear: { select: { name: true } }, classRel: { select: { name: true } } },
      orderBy: [{ classId: "asc" }, { category: "asc" }],
    });
    res.json(schedules);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const createFeeSchedule = async (req: AuthRequest, res: Response) => {
  try {
    const { academicYearId, classId, category, amount, frequency } = req.body;
    if (!academicYearId || !category || amount == null) {
      return res.status(400).json({ error: "academicYearId, category, and amount are required" });
    }
    if (frequency && !VALID_FREQUENCIES.includes(frequency)) {
      return res.status(400).json({ error: `frequency must be one of: ${VALID_FREQUENCIES.join(", ")}` });
    }
    const schedule = await prisma.feeSchedule.create({
      data: {
        academicYearId,
        classId: classId || null,
        category,
        amount: Number(amount),
        frequency: frequency || "MONTHLY",
      },
    });
    logAudit({ userId: req.session?.user?.id, action: "CREATE", entityType: "FeeSchedule", entityId: schedule.id, details: JSON.stringify({ academicYearId, classId, category, amount }) });
    res.status(201).json(schedule);
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};

export const updateFeeSchedule = async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const { category, amount, frequency, classId } = req.body;
    const data: any = {};
    if (category !== undefined) data.category = category;
    if (amount != null) data.amount = Number(amount);
    if (frequency !== undefined) {
      if (!VALID_FREQUENCIES.includes(frequency)) {
        return res.status(400).json({ error: `frequency must be one of: ${VALID_FREQUENCIES.join(", ")}` });
      }
      data.frequency = frequency;
    }
    if (classId !== undefined) data.classId = classId || null;
    const schedule = await prisma.feeSchedule.update({ where: { id }, data });
    logAudit({ userId: req.session?.user?.id, action: "UPDATE", entityType: "FeeSchedule", entityId: id, details: JSON.stringify(data) });
    res.json(schedule);
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};

export const deleteFeeSchedule = async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.feeSchedule.delete({ where: { id } });
    logAudit({ userId: req.session?.user?.id, action: "DELETE", entityType: "FeeSchedule", entityId: id });
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};
