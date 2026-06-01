import type { Request, Response } from "express";
import { createHash } from "crypto";
import { param } from "../lib/param.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError, errorStatus } from "../lib/errors.js";
import { validate, createStudentSchema } from "../lib/validate.js";
import { logAudit } from "../lib/audit.js";
import { parsePhoto, detectMimeType } from "../lib/photo.js";

async function resolveClassId(className: string): Promise<string | null> {
  const cls = await prisma.schoolClass.findUnique({ where: { name: className } });
  return cls?.id || null;
}

export const getAllStudents = async (req: Request, res: Response) => {
  try {
    const skip = Math.max(0, parseInt(String(req.query.skip || '0')));
    const take = Math.min(500, Math.max(1, parseInt(String(req.query.take || '200'))));
    const showGraduated = req.query.showGraduated === 'true';
    const where: any = { deletedAt: null };
    if (!showGraduated) where.graduatedAt = null;
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.student.count({ where }),
    ]);
    const result = students.map((s) => ({
      id: s.id,
      classId: s.classId,
      class: s.class,
      roll: s.roll,
      name: s.name,
      fatherName: s.fatherName,
      motherName: s.motherName,
      contact: s.contact,
      hasPhoto: !!s.photo,
      hasGraduated: !!s.graduatedAt,
      createdAt: s.createdAt,
    }));
    res.json({ data: result, total, skip, take });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const createStudent = async (req: Request, res: Response) => {
  try {
    const v = validate(createStudentSchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { class: className, roll, name, fatherName, motherName, contact } = v.data;
    const parsed = parsePhoto(req.body);
    const classId = await resolveClassId(className);

    const student = await prisma.student.create({
      data: {
        class: className,
        classId,
        roll: roll || null,
        name,
        fatherName: fatherName || null,
        motherName: motherName || null,
        contact: contact || null,
        photo: parsed?.buffer ?? null,
      },
    });

    logAudit({ action: "CREATE", entityType: "Student", entityId: student.id, details: JSON.stringify({ name, class: className }) });
    res.status(201).json({ ...student, photo: null });
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const updateStudent = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const v = validate(createStudentSchema.partial(), req.body);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { class: className, roll, name, fatherName, motherName, contact } = v.data;
    const parsed = parsePhoto(req.body);

    const data: any = {
      ...(className !== undefined && { class: className }),
      ...(className !== undefined && { classId: await resolveClassId(className) }),
      ...(roll !== undefined && { roll: roll || null }),
      ...(name !== undefined && { name }),
      ...(fatherName !== undefined && { fatherName: fatherName || null }),
      ...(motherName !== undefined && { motherName: motherName || null }),
      ...(contact !== undefined && { contact: contact || null }),
    };
    if (parsed) data.photo = parsed.buffer;

    const student = await prisma.student.update({
      where: { id },
      data,
      include: { results: true },
    });

    logAudit({ action: "UPDATE", entityType: "Student", entityId: id, details: JSON.stringify({ changes: Object.keys(data) }) });
    res.json({
      ...student,
      photo: undefined,
      hasPhoto: !!student.photo,
    });
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const deleteStudent = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.student.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json({ message: "Student deleted", id });
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const restoreStudent = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.student.update({ where: { id }, data: { deletedAt: null } });
    res.json({ message: "Student restored", id });
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const graduateStudent = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.student.update({ where: { id }, data: { graduatedAt: new Date() } });
    logAudit({ action: "GRADUATE", entityType: "Student", entityId: id, details: "Student graduated" });
    res.json({ message: "Student graduated" });
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const ungraduateStudent = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.student.update({ where: { id }, data: { graduatedAt: null } });
    logAudit({ action: "UNGRADUATE", entityType: "Student", entityId: id, details: "Student graduation undone" });
    res.json({ message: "Student graduation undone" });
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const graduateClass = async (req: Request, res: Response) => {
  try {
    const classId = param(req, "classId");
    const cls = await prisma.schoolClass.findUnique({ where: { id: classId } });
    if (!cls) return res.status(404).json({ error: "Class not found" });
    const result = await prisma.student.updateMany({
      where: { classId, deletedAt: null, graduatedAt: null },
      data: { graduatedAt: new Date() },
    });
    logAudit({ action: "GRADUATE_CLASS", entityType: "Student", entityId: classId, details: `Graduated ${result.count} students from ${cls.name}` });
    res.json({ message: `${result.count} students graduated` });
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const importStudents = async (req: Request, res: Response) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: "Send { students: [...] } with at least one student" });
    }
    if (students.length > 500) {
      return res.status(400).json({ error: "Maximum 500 students per import" });
    }

    const classNames = [...new Set(students.map((s: any) => s.class).filter(Boolean))] as string[];
    const existingClasses = await prisma.schoolClass.findMany({
      where: { name: { in: classNames } },
      select: { id: true, name: true },
    });
    const classMap = new Map(existingClasses.map((c) => [c.name, c.id]));

    const created: any[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      if (!s.name || !s.class) {
        errors.push({ row: i + 1, error: !s.name ? "Name is required" : "Class is required" });
        continue;
      }
      try {
        const student = await prisma.student.create({
          data: {
            class: s.class,
            classId: classMap.get(s.class) || null,
            roll: s.roll || null,
            name: s.name,
            fatherName: s.fatherName || null,
            motherName: s.motherName || null,
            contact: s.contact || null,
          },
        });
        created.push({ id: student.id, name: student.name, class: student.class, roll: student.roll });
      } catch (e: any) {
        errors.push({ row: i + 1, error: e.message || "Create failed" });
      }
    }

    logAudit({ action: "IMPORT", entityType: "Student", entityId: `batch-${created.length}`, details: JSON.stringify({ created: created.length, errors: errors.length }) });
    res.status(201).json({ created: created.length, errors, students: created });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const getStudentPhoto = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const student = await prisma.student.findUnique({ where: { id }, select: { photo: true } });
    if (!student?.photo) return res.status(404).json({ error: "Photo not found" });

    const buf = Buffer.from(student.photo);
    const etag = createHash('md5').update(buf).digest('hex');
    if (req.headers['if-none-match'] === etag) { return res.status(304).end(); }
    res.set("Content-Type", detectMimeType(buf) || 'application/octet-stream');
    res.set("Cache-Control", "public, max-age=86400");
    res.set("ETag", etag);
    res.send(buf);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};
