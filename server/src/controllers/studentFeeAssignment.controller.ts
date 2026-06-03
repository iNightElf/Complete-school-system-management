import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError, errorStatus, handleControllerError } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import { param } from "../lib/param.js";

export const getStudentFeeAssignments = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, feeScheduleId, className, active, page: pageStr, limit: limitStr } = req.query;
    const where: any = {};
    if (studentId) where.studentId = String(studentId);
    if (feeScheduleId) where.feeScheduleId = String(feeScheduleId);
    if (active !== undefined) where.active = active === "true";

    const page = pageStr ? Math.max(1, parseInt(String(pageStr), 10) || 1) : undefined;
    const limit = page ? Math.min(200, Math.max(1, parseInt(String(limitStr || '50'), 10) || 50)) : undefined;

    let assignments: any[];
    if (page) {
      [assignments] = await Promise.all([
        prisma.studentFeeAssignment.findMany({
          where,
          include: {
            student: { select: { id: true, name: true, class: true, studentId: true } },
            feeSchedule: { select: { id: true, category: true, amount: true, frequency: true, classRel: { select: { name: true } } } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit!,
          take: limit!,
        }),
      ]);
    } else {
      assignments = await prisma.studentFeeAssignment.findMany({
        where,
        include: {
          student: { select: { id: true, name: true, class: true, studentId: true } },
          feeSchedule: { select: { id: true, category: true, amount: true, frequency: true, classRel: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });
    }

    if (className) {
      const classStudents = await prisma.student.findMany({ where: { class: String(className) }, select: { id: true } });
      const ids = new Set(classStudents.map(s => s.id));
      assignments = assignments.filter(a => ids.has(a.studentId));
    }

    res.json(assignments);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const toggleStudentFeeAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, feeScheduleId, active, startsAt, endsAt, note } = req.body;
    if (!studentId || !feeScheduleId) {
      return res.status(400).json({ error: "studentId and feeScheduleId are required" });
    }

    const existing = await prisma.studentFeeAssignment.findFirst({
      where: { studentId, feeScheduleId, active: true },
    });

    // Explicit deactivation
    if (active === false) {
      if (existing) {
        const updated = await prisma.studentFeeAssignment.update({
          where: { id: existing.id },
          data: { active: false },
        });
        logAudit({ userId: req.user?.id, action: "DEACTIVATE", entityType: "StudentFeeAssignment", entityId: updated.id, details: JSON.stringify({ studentId, feeScheduleId }) });
        return res.json(updated);
      }
      return res.json({ message: "Already inactive" });
    }

    // Pure toggle (no params) — flip off if currently active
    if (active === undefined && startsAt === undefined && endsAt === undefined && note === undefined) {
      if (existing) {
        const updated = await prisma.studentFeeAssignment.update({
          where: { id: existing.id },
          data: { active: false },
        });
        logAudit({ userId: req.user?.id, action: "DEACTIVATE", entityType: "StudentFeeAssignment", entityId: updated.id, details: JSON.stringify({ studentId, feeScheduleId }) });
        return res.json(updated);
      }
      return res.json({ message: "Already inactive" });
    }

    // Activate or update — deactivate old, create new
    if (existing) {
      await prisma.studentFeeAssignment.update({
        where: { id: existing.id },
        data: { active: false },
      });
    }

    const created = await prisma.studentFeeAssignment.create({
      data: { studentId, feeScheduleId, active: true, startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null, note },
    });
    logAudit({ userId: req.user?.id, action: "CREATE", entityType: "StudentFeeAssignment", entityId: created.id, details: JSON.stringify({ studentId, feeScheduleId }) });
    res.status(201).json(created);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const bulkAssign = async (req: AuthRequest, res: Response) => {
  try {
    const { feeScheduleId, studentIds, active, startsAt, endsAt } = req.body;
    if (!feeScheduleId || !Array.isArray(studentIds)) {
      return res.status(400).json({ error: "feeScheduleId and studentIds array are required" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.studentFeeAssignment.updateMany({
        where: { studentId: { in: studentIds }, feeScheduleId, active: true },
        data: { active: false },
      });
      await tx.studentFeeAssignment.createMany({
        data: studentIds.map((sid: string) => ({
          studentId: sid,
          feeScheduleId,
          active: active !== undefined ? active : true,
          ...(startsAt?.trim() ? { startsAt: new Date(startsAt) } : {}),
          ...(endsAt?.trim() ? { endsAt: new Date(endsAt) } : {}),
        })),
      });
    });

    logAudit({ userId: req.user?.id, action: "BULK_ASSIGN", entityType: "StudentFeeAssignment", entityId: feeScheduleId, details: JSON.stringify({ studentIds: studentIds.length, count: studentIds.length }) });
    res.json({ count: studentIds.length });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};
