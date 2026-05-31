import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import { param } from "../lib/param.js";

export const getStudentFeeAssignments = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, feeScheduleId, className } = req.query;
    const where: any = {};
    if (studentId) where.studentId = String(studentId);
    if (feeScheduleId) where.feeScheduleId = String(feeScheduleId);

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

    const existing = await prisma.studentFeeAssignment.findUnique({
      where: { studentId_feeScheduleId: { studentId, feeScheduleId } },
    });

    if (existing) {
      const updated = await prisma.studentFeeAssignment.update({
        where: { id: existing.id },
        data: {
          active: active !== undefined ? active : !existing.active,
          startsAt: startsAt !== undefined ? (startsAt ? new Date(startsAt) : null) : undefined,
          endsAt: endsAt !== undefined ? (endsAt ? new Date(endsAt) : null) : undefined,
          note: note !== undefined ? note : undefined,
        },
      });
      logAudit({ userId: req.session?.user?.id, action: "UPDATE", entityType: "StudentFeeAssignment", entityId: updated.id, details: JSON.stringify({ studentId, feeScheduleId, active: updated.active }) });
      return res.json(updated);
    }

    const created = await prisma.studentFeeAssignment.create({
      data: { studentId, feeScheduleId, active: active !== undefined ? active : true, startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null, note },
    });
    logAudit({ userId: req.session?.user?.id, action: "CREATE", entityType: "StudentFeeAssignment", entityId: created.id, details: JSON.stringify({ studentId, feeScheduleId }) });
    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};

export const bulkAssign = async (req: AuthRequest, res: Response) => {
  try {
    const { feeScheduleId, studentIds, active } = req.body;
    if (!feeScheduleId || !Array.isArray(studentIds)) {
      return res.status(400).json({ error: "feeScheduleId and studentIds array are required" });
    }

    const results = await Promise.allSettled(
      studentIds.map((sid: string) =>
        prisma.studentFeeAssignment.upsert({
          where: { studentId_feeScheduleId: { studentId: sid, feeScheduleId } },
          update: { active: active !== undefined ? active : true },
          create: { studentId: sid, feeScheduleId, active: active !== undefined ? active : true },
        })
      )
    );

    const count = results.filter(r => r.status === "fulfilled").length;
    logAudit({ userId: req.session?.user?.id, action: "BULK_ASSIGN", entityType: "StudentFeeAssignment", entityId: feeScheduleId, details: JSON.stringify({ studentIds: studentIds.length, count }) });
    res.json({ count });
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};
