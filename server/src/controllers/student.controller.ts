import type { Request, Response } from "express";
import { createHash } from "crypto";
import { param } from "../lib/param.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError } from "../lib/errors.js";
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
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.student.count(),
    ]);
    const result = students.map((s) => ({
      id: s.id,
      class: s.class,
      roll: s.roll,
      name: s.name,
      fatherName: s.fatherName,
      motherName: s.motherName,
      contact: s.contact,
      hasPhoto: !!s.photo,
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
    res.status(400).json({ error: sanitizeError(error) });
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
    res.status(400).json({ error: sanitizeError(error) });
  }
};

export const deleteStudent = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.student.delete({ where: { id } });
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
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
