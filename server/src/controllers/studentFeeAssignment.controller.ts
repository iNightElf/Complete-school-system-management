import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError, errorStatus } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import { param } from "../lib/param.js";

export const getStudentFeeAssignments = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, feeScheduleId, className, active } = req.query;
    const where: any = {};
    if (studentId) where.studentId = String(studentId);
    if (feeScheduleId) where.feeScheduleId = String(feeScheduleId);
    if (active !== undefined) where.active = active === "true";

    let assignments = await prisma.studentFeeAssignment.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, class: true, roll: true } },
        feeSchedule: { select: { id: true, category: true, amount: true, frequency: true, classRel: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (className) {
      const classStudents = await prisma.student.findMany({ where: { class: String(className) }, select: { id: true } });
      const ids = new Set(classStudents.map(s => s.id));
      assignments = assignments.filter(a => ids.has(a.studentId));
    }

    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const toggleStudentFeeAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, feeScheduleId, active, startsAt, endsAt, note } = req.body;
    if (!studentId || !feeScheduleId) {
      return res.status(400).json({ error: "studentId and feeScheduleId are required" });
    }

    // Find existing active record
    const existing = await prisma.studentFeeAssignment.findFirst({
      where: { studentId, feeScheduleId, active: true },
    });

    const newActive = active !== undefined ? active : !existing;

    if (existing) {
      if (newActive === existing.active && startsAt === undefined && endsAt === undefined && note === undefined) {
        // Toggle off — deactivate only (immutable)
        const updated = await prisma.studentFeeAssignment.update({
          where: { id: existing.id },
          data: { active: false },
        });
        logAudit({ userId: req.session?.user?.id, action: "DEACTIVATE", entityType: "StudentFeeAssignment", entityId: updated.id, details: JSON.stringify({ studentId, feeScheduleId }) });
        return res.json(updated);
      }
      // Deactivate old (immutable history)
      await prisma.studentFeeAssignment.update({
        where: { id: existing.id },
        data: { active: false },
      });
    }

    const created = await prisma.studentFeeAssignment.create({
      data: { studentId, feeScheduleId, active: true, startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null, note },
    });
    logAudit({ userId: req.session?.user?.id, action: "CREATE", entityType: "StudentFeeAssignment", entityId: created.id, details: JSON.stringify({ studentId, feeScheduleId }) });
    res.status(201).json(created);
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const bulkAssign = async (req: AuthRequest, res: Response) => {
  try {
    const { feeScheduleId, studentIds, active, startsAt, endsAt } = req.body;
    if (!feeScheduleId || !Array.isArray(studentIds)) {
      return res.status(400).json({ error: "feeScheduleId and studentIds array are required" });
    }

    const count = await prisma.$transaction(async (tx) => {
      let done = 0;
      for (const sid of studentIds) {
        await tx.studentFeeAssignment.updateMany({
          where: { studentId: sid, feeScheduleId, active: true },
          data: { active: false },
        });
        await tx.studentFeeAssignment.create({
          data: {
            studentId: sid,
            feeScheduleId,
            active: active !== undefined ? active : true,
            ...(startsAt ? { startsAt: new Date(startsAt) } : {}),
            ...(endsAt ? { endsAt: new Date(endsAt) } : {}),
          },
        });
        done++;
      }
      return done;
    });

    logAudit({ userId: req.session?.user?.id, action: "BULK_ASSIGN", entityType: "StudentFeeAssignment", entityId: feeScheduleId, details: JSON.stringify({ studentIds: studentIds.length, count }) });
    res.json({ count });
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};
