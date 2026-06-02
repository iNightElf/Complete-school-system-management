import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError, errorStatus } from "../lib/errors.js";
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
    const { academicYearId, classId, category, amount, frequency, applicability } = req.body;
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
        applicability: applicability || "AUTO",
      },
    });
    logAudit({ userId: req.user?.id, action: "CREATE", entityType: "FeeSchedule", entityId: schedule.id, details: JSON.stringify({ academicYearId, classId, category, amount }) });
    res.status(201).json(schedule);
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const updateFeeSchedule = async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const { category, amount, frequency, classId, applicability } = req.body;
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
    if (applicability !== undefined) data.applicability = applicability;
    const schedule = await prisma.feeSchedule.update({ where: { id }, data });
    logAudit({ userId: req.user?.id, action: "UPDATE", entityType: "FeeSchedule", entityId: id, details: JSON.stringify(data) });
    res.json(schedule);
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const copyFeeSchedulesFromYear = async (req: AuthRequest, res: Response) => {
  try {
    const { sourceAcademicYearId, targetAcademicYearId } = req.body;
    if (!sourceAcademicYearId || !targetAcademicYearId) {
      return res.status(400).json({ error: "sourceAcademicYearId and targetAcademicYearId are required" });
    }
    const sourceSchedules = await prisma.feeSchedule.findMany({ where: { academicYearId: sourceAcademicYearId } });
    if (sourceSchedules.length === 0) {
      return res.status(404).json({ error: "No fee schedules found in the source year" });
    }
    let copied = 0;
    let skipped = 0;
    for (const s of sourceSchedules) {
      try {
        await prisma.feeSchedule.create({
          data: {
            academicYearId: targetAcademicYearId,
            classId: s.classId,
            category: s.category,
            amount: s.amount,
            frequency: s.frequency,
            applicability: s.applicability,
            effectiveFrom: s.effectiveFrom,
            effectiveTo: s.effectiveTo,
          },
        });
        copied++;
      } catch (e: any) {
        if (e.code === 'P2002') { skipped++; continue; }
        throw e;
      }
    }
    logAudit({ userId: req.user?.id, action: "CREATE", entityType: "FeeSchedule", details: `Copied ${copied} schedules from year ${sourceAcademicYearId} to ${targetAcademicYearId} (${skipped} skipped)` });
    const targetSchedules = await prisma.feeSchedule.findMany({
      where: { academicYearId: targetAcademicYearId },
      include: { academicYear: { select: { name: true } }, classRel: { select: { name: true } } },
      orderBy: [{ classId: "asc" }, { category: "asc" }],
    });
    res.json({ copied, skipped, schedules: targetSchedules });
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const deleteFeeSchedule = async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.feeSchedule.delete({ where: { id } });
    logAudit({ userId: req.user?.id, action: "DELETE", entityType: "FeeSchedule", entityId: id });
    res.json({ message: "Fee schedule deleted" });
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};
