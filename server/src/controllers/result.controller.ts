import type { Request, Response } from "express";
import { param } from "../lib/param.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError, errorStatus } from "../lib/errors.js";
import { validate, saveStudentResultSchema, createSubjectSchema, updateSubjectSchema } from "../lib/validate.js";

export const getSubjectsByClass = async (req: Request, res: Response) => {
  try {
    const classId = param(req, "classId");
    const cls = await prisma.schoolClass.findUnique({ where: { id: classId } });
    if (!cls) return res.status(404).json({ error: "Class not found" });

    const subjects = await prisma.subject.findMany({
      where: { classId },
      orderBy: { order: "asc" },
    });

    res.json(subjects);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const createSubject = async (req: Request, res: Response) => {
  try {
    const classId = param(req, "classId");
    const v = validate(createSubjectSchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { name, fullMarks } = v.data;

    const cls = await prisma.schoolClass.findUnique({ where: { id: classId } });
    if (!cls) return res.status(404).json({ error: "Class not found" });

    const maxOrder = await prisma.subject.aggregate({ where: { classId }, _max: { order: true } });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const subject = await prisma.subject.create({
      data: { name, fullMarks, classId, order: nextOrder },
    });

    res.status(201).json(subject);
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const updateSubject = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const v = validate(updateSubjectSchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });

    const subject = await prisma.subject.update({
      where: { id },
      data: v.data,
    });

    res.json(subject);
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const deleteSubject = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.subject.delete({ where: { id } });
    res.json({ message: "Subject deleted" });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const getStudentResults = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return res.status(404).json({ error: "Student not found" });
    const { session } = req.query;
    const where: any = { studentId: id };
    if (session) where.session = String(session);
    const results = await prisma.result.findMany({
      where,
      orderBy: { term: "asc" },
    });

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const saveStudentResult = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const { session, term, marks, attendance, comment } = req.body;

    if (!term || marks === undefined) {
      return res.status(400).json({ error: "Term and marks are required" });
    }

    const validation = validate(saveStudentResultSchema, req.body);
    if (!validation.success) return res.status(400).json({ error: validation.error });

    const sessionVal = session || String(new Date().getFullYear());

    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return res.status(404).json({ error: "Student not found" });

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.result.findUnique({
        where: { studentId_term_session: { studentId: id, term: String(term), session: sessionVal } },
      });
      const marksKeys = marks && typeof marks === 'object' ? Object.keys(marks) : [];
      const mergedMarks = existing && marksKeys.length > 0
        ? { ...((existing.marks as Record<string, number>) || {}), ...marks }
        : (existing && marksKeys.length === 0 ? existing.marks : marks);
      const mergedAttendance = attendance && existing?.attendance
        ? { ...((existing.attendance as Record<string, number>) || {}), ...attendance }
        : (attendance || existing?.attendance);

      return tx.result.upsert({
        where: { studentId_term_session: { studentId: id, term: String(term), session: sessionVal } },
        create: {
          studentId: id,
          session: sessionVal,
          term: String(term),
          marks: mergedMarks,
          attendance: mergedAttendance || null,
          comment: comment || null,
        },
        update: {
          marks: mergedMarks,
          attendance: mergedAttendance,
          ...(comment !== undefined ? { comment } : {}),
        },
      });
    });

    res.json(result);
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const getClassResults = async (req: Request, res: Response) => {
  try {
    const classId = param(req, "classId");
    const { session } = req.query;
    const cls = await prisma.schoolClass.findUnique({ where: { id: classId } });
    if (!cls) return res.status(404).json({ error: "Class not found" });

    const where: any = { student: { class: cls.name } };
    if (session) where.session = String(session);

    const results = await prisma.result.findMany({
      where,
      orderBy: [{ studentId: "asc" }, { term: "asc" }],
    });

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const deleteClassResultsOnly = async (req: Request, res: Response) => {
  try {
    const classId = param(req, "classId");
    const cls = await prisma.schoolClass.findUnique({ where: { id: classId } });
    if (!cls) return res.status(404).json({ error: "Class not found" });

    const students = await prisma.student.findMany({
      where: { class: cls.name },
      select: { id: true },
    });

    const studentIds = students.map((s) => s.id);

    await prisma.result.deleteMany({
      where: { studentId: { in: studentIds } },
    });

    res.json({ message: "All results for this class deleted" });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const deleteClassSubjects = async (req: Request, res: Response) => {
  try {
    const classId = param(req, "classId");
    const cls = await prisma.schoolClass.findUnique({ where: { id: classId } });
    if (!cls) return res.status(404).json({ error: "Class not found" });

    await prisma.subject.deleteMany({ where: { classId } });

    res.json({ message: "All subjects for this class deleted" });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};
