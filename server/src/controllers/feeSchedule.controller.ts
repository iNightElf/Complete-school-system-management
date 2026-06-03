import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError, errorStatus, handleControllerError } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import { param } from "../lib/param.js";

const VALID_FREQUENCIES = ["MONTHLY", "YEARLY", "ONETIME"];

export const getFeeSchedules = async (req: Request, res: Response) => {
  try {
    const { academicYearId, classId, page: pageStr, limit: limitStr } = req.query;
    const where: any = {};
    if (academicYearId) where.academicYearId = String(academicYearId);
    if (classId) where.classId = String(classId);
    const page = pageStr ? Math.max(1, parseInt(String(pageStr), 10) || 1) : undefined;
    const limit = page ? Math.min(500, Math.max(1, parseInt(String(limitStr || '100'), 10) || 100)) : undefined;
    if (page) {
      const [schedules, total] = await Promise.all([
        prisma.feeSchedule.findMany({
          where,
          include: { academicYear: { select: { name: true } }, classRel: { select: { name: true } } },
          orderBy: [{ classId: "asc" }, { category: "asc" }],
          skip: (page - 1) * limit!,
          take: limit!,
        }),
        prisma.feeSchedule.count({ where }),
      ]);
      return res.json({ data: schedules, total, page, totalPages: Math.ceil(total / limit!) });
    }
    const schedules = await prisma.feeSchedule.findMany({
      where,
      include: { academicYear: { select: { name: true } }, classRel: { select: { name: true } } },
      orderBy: [{ classId: "asc" }, { category: "asc" }],
      take: 5000,
    });
    res.json(schedules);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
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
    handleControllerError(res, error, req.path);
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
    handleControllerError(res, error, req.path);
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
    const { count } = await prisma.feeSchedule.createMany({
      data: sourceSchedules.map(s => ({
        academicYearId: targetAcademicYearId,
        classId: s.classId,
        category: s.category,
        amount: s.amount,
        frequency: s.frequency,
        applicability: s.applicability,
        effectiveFrom: s.effectiveFrom,
        effectiveTo: s.effectiveTo,
      })),
      skipDuplicates: true,
    });
    const skipped = sourceSchedules.length - count;
    logAudit({ userId: req.user?.id, action: "CREATE", entityType: "FeeSchedule", details: `Copied ${count} schedules from year ${sourceAcademicYearId} to ${targetAcademicYearId} (${skipped} skipped)` });
    const targetSchedules = await prisma.feeSchedule.findMany({
      where: { academicYearId: targetAcademicYearId },
      include: { academicYear: { select: { name: true } }, classRel: { select: { name: true } } },
      orderBy: [{ classId: "asc" }, { category: "asc" }],
    });
    res.json({ copied: count, skipped, schedules: targetSchedules });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const deleteFeeSchedule = async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.feeSchedule.delete({ where: { id } });
    logAudit({ userId: req.user?.id, action: "DELETE", entityType: "FeeSchedule", entityId: id });
    res.json({ message: "Fee schedule deleted" });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};
