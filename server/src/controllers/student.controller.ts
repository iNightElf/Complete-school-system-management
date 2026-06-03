import type { Request, Response } from "express";
import { createHash } from "crypto";
import { param } from "../lib/param.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError, errorStatus, handleControllerError } from "../lib/errors.js";
import { validate, createStudentSchema } from "../lib/validate.js";
import { logAudit } from "../lib/audit.js";
import { parsePhoto, detectMimeType } from "../lib/photo.js";
import { uploadPhoto, getSignedUrl, getPhotoUrl, deletePhoto } from "../lib/supabase.js";
import { uploadPhotoAsync } from "../lib/queue.js";

const BUCKET = "student-photos";

async function resolveClassId(className: string): Promise<string | null> {
  const cls = await prisma.schoolClass.findUnique({ where: { name: className } });
  return cls?.id || null;
}

async function nextStudentId(): Promise<string> {
  const result = await prisma.student.aggregate({
    _max: { studentId: true },
  });
  const maxId = result._max.studentId || 'S000000';
  const num = parseInt(maxId.replace(/\D/g, ''), 10) || 0;
  return `S${String(num + 1).padStart(6, '0')}`;
}

async function generateStudentIdWithRetry(maxAttempts = 5): Promise<string> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const id = await nextStudentId();
    const exists = await prisma.student.findUnique({ where: { studentId: id }, select: { id: true } });
    if (!exists) return id;
  }
  throw new Error('Failed to generate unique student ID after ' + maxAttempts + ' attempts');
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
    const result = await Promise.all(students.map(async (s) => ({
      id: s.id,
      classId: s.classId,
      class: s.class,
      studentId: s.studentId,
      roll: s.roll,
      session: s.session,
      name: s.name,
      fatherName: s.fatherName,
      motherName: s.motherName,
      contact: s.contact,
      photoUrl: s.photoPath ? await getPhotoUrl(BUCKET, s.photoPath) : null,
      hasPhoto: !!(s.photoPath || s.photo),
      hasGraduated: !!s.graduatedAt,
      createdAt: s.createdAt,
    })));
    res.json({ data: result, total, skip, take });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const createStudent = async (req: Request, res: Response) => {
  try {
    const v = validate(createStudentSchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { class: className, roll, name, fatherName, motherName, contact, session } = v.data;
    const parsed = parsePhoto(req.body);
    const classId = await resolveClassId(className);

    // Retry loop to handle concurrent studentId race
    let lastError: any;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const studentId = await generateStudentIdWithRetry();
        const student = await prisma.student.create({
          data: {
            class: className,
            classId,
            studentId,
            roll: roll || null,
            session: session || null,
            name,
            fatherName: fatherName || null,
            motherName: motherName || null,
            contact: contact || null,
          },
        });

        if (parsed) {
          uploadPhotoAsync(BUCKET, "students", student.id, parsed.buffer, parsed.mimeType);
        }

        logAudit({ action: "CREATE", entityType: "Student", entityId: student.id, details: JSON.stringify({ name, class: className }) });
        return res.status(201).json({
          id: student.id,
          classId: student.classId,
          class: student.class,
          studentId: student.studentId,
          roll: student.roll,
          session: student.session,
          name: student.name,
          fatherName: student.fatherName,
          motherName: student.motherName,
          contact: student.contact,
          photoUrl: null,
          hasPhoto: false,
          hasGraduated: false,
          createdAt: student.createdAt,
        });
      } catch (err: any) {
        lastError = err;
        if (err?.code === 'P2002' && err?.meta?.target?.includes('studentId')) {
          continue; // retry with new ID
        }
        throw err;
      }
    }
    throw lastError || new Error('Failed to create student after retries');
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const updateStudent = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const v = validate(createStudentSchema.partial(), req.body);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { class: className, roll, name, fatherName, motherName, contact, session } = v.data;
    const parsed = parsePhoto(req.body);

    const data: any = {
      ...(className !== undefined && { class: className }),
      ...(className !== undefined && { classId: await resolveClassId(className) }),
      ...(roll !== undefined && { roll: roll || null }),
      ...(name !== undefined && { name }),
      ...(fatherName !== undefined && { fatherName: fatherName || null }),
      ...(motherName !== undefined && { motherName: motherName || null }),
      ...(contact !== undefined && { contact: contact || null }),
      ...(session !== undefined && { session: session || null }),
    };

    const existing = await prisma.student.findUnique({ where: { id }, select: { photoPath: true } });

    if (parsed) {
      if (existing?.photoPath) await deletePhoto(BUCKET, existing.photoPath);
      uploadPhotoAsync(BUCKET, "students", id, parsed.buffer, parsed.mimeType);
    } else if (req.body.clearPhoto === true && existing?.photoPath) {
      await deletePhoto(BUCKET, existing.photoPath);
      data.photoPath = null;
    }

    const student = await prisma.student.update({
      where: { id },
      data,
    });

    logAudit({ action: "UPDATE", entityType: "Student", entityId: id, details: JSON.stringify({ changes: Object.keys(data) }) });
    res.json({
      id: student.id,
      classId: student.classId,
      class: student.class,
      studentId: student.studentId,
      roll: student.roll,
      session: student.session,
      name: student.name,
      fatherName: student.fatherName,
      motherName: student.motherName,
      contact: student.contact,
      photoUrl: student.photoPath ? await getSignedUrl(BUCKET, student.photoPath) : null,
      hasPhoto: !!(student.photoPath || student.photo),
      hasGraduated: !!student.graduatedAt,
      createdAt: student.createdAt,
    });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const deleteStudent = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.student.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json({ message: "Student deleted", id });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const restoreStudent = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.student.update({ where: { id }, data: { deletedAt: null } });
    res.json({ message: "Student restored", id });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const graduateStudent = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.student.update({ where: { id }, data: { graduatedAt: new Date() } });
    logAudit({ action: "GRADUATE", entityType: "Student", entityId: id, details: "Student graduated" });
    res.json({ message: "Student graduated" });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const ungraduateStudent = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.student.update({ where: { id }, data: { graduatedAt: null } });
    logAudit({ action: "UNGRADUATE", entityType: "Student", entityId: id, details: "Student graduation undone" });
    res.json({ message: "Student graduation undone" });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
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
    handleControllerError(res, error, req.path);
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

    const errors: { row: number; error: string }[] = [];
    const valid: any[] = [];

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      if (!s.name || !s.class) {
        errors.push({ row: i + 1, error: !s.name ? "Name is required" : "Class is required" });
        continue;
      }
      valid.push(s);
    }

    if (valid.length === 0) {
      return res.status(400).json({ created: 0, errors, students: [] });
    }

    const result = await prisma.student.aggregate({ _max: { studentId: true } });
    const maxId = result._max.studentId || 'S000000';
    const startNum = parseInt(maxId.replace(/\D/g, ''), 10) || 0;

    const data = valid.map((s: any, i: number) => ({
      class: s.class,
      classId: classMap.get(s.class) || null,
      studentId: `S${String(startNum + 1 + i).padStart(6, '0')}`,
      roll: s.roll || null,
      session: s.session || null,
      name: s.name,
      fatherName: s.fatherName || null,
      motherName: s.motherName || null,
      contact: s.contact || null,
    }));

    const created = await prisma.student.createManyAndReturn({
      data,
      select: { id: true, name: true, class: true, studentId: true, roll: true },
    });

    logAudit({ action: "IMPORT", entityType: "Student", entityId: `batch-${created.length}`, details: JSON.stringify({ created: created.length, errors: errors.length }) });
    res.status(201).json({ created: created.length, errors, students: created });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const getStudentPhoto = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const student = await prisma.student.findUnique({ where: { id }, select: { photo: true, photoPath: true } });
    if (!student?.photo && !student?.photoPath) return res.status(404).json({ error: "Photo not found" });

    // Serve from Supabase Storage if migrated
    if (student.photoPath) {
      const url = await getSignedUrl(BUCKET, student.photoPath, 3600);
      if (url) return res.redirect(url);
    }

    // Fall back to raw bytes from DB
    if (!student.photo) return res.status(404).json({ error: "Photo not found" });
    const buf = Buffer.from(student.photo);
    const etag = createHash('md5').update(buf).digest('hex');
    if (req.headers['if-none-match'] === etag) { return res.status(304).end(); }
    res.set("Content-Type", detectMimeType(buf) || 'application/octet-stream');
    res.set("Cache-Control", "public, max-age=86400");
    res.set("ETag", etag);
    res.send(buf);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};
