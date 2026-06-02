import type { Request, Response } from "express";
import { createHash } from "crypto";
import { param } from "../lib/param.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError, errorStatus } from "../lib/errors.js";
import { validate, createTeacherSchema, createStaffSchema, createBookSchema } from "../lib/validate.js";
import { parsePhoto, detectMimeType } from "../lib/photo.js";
import { uploadPhoto, getSignedUrl, deletePhoto } from "../lib/supabase.js";
import { logAudit } from "../lib/audit.js";

const PHOTO_BUCKET = "student-photos";

// ── Teachers ──

export const importTeachers = async (req: Request, res: Response) => {
  try {
    const { teachers } = req.body;
    if (!Array.isArray(teachers) || teachers.length === 0) {
      return res.status(400).json({ error: "Send { teachers: [...] } with at least one teacher" });
    }
    if (teachers.length > 500) return res.status(400).json({ error: "Maximum 500 per import" });

    const created: any[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < teachers.length; i++) {
      const t = teachers[i];
      if (!t.name || !t.designation) {
        errors.push({ row: i + 1, error: !t.name ? "Name is required" : "Designation is required" });
        continue;
      }
      try {
        const teacher = await prisma.teacher.create({
          data: { designation: t.designation, name: t.name, email: t.email || null, contact: t.contact || null },
        });
        created.push({ id: teacher.id, name: teacher.name, designation: teacher.designation });
      } catch (e: any) {
        errors.push({ row: i + 1, error: sanitizeError(e) });
      }
    }

    logAudit({ action: "IMPORT", entityType: "Teacher", entityId: `batch-${created.length}`, details: JSON.stringify({ created: created.length, errors: errors.length }) });
    res.status(201).json({ created: created.length, errors, teachers: created });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const getAllTeachers = async (req: Request, res: Response) => {
  try {
    const skip = Math.max(0, parseInt(String(req.query.skip || '0')));
    const take = Math.min(500, Math.max(1, parseInt(String(req.query.take || '200'))));
    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.teacher.count({ where: { deletedAt: null } }),
    ]);
    const result = await Promise.all(teachers.map(async (t) => ({
      id: t.id,
      designation: t.designation,
      name: t.name,
      email: t.email,
      contact: t.contact,
      photoUrl: t.photoPath ? await getSignedUrl(PHOTO_BUCKET, t.photoPath) : null,
      hasPhoto: !!(t.photoPath || t.photo),
      createdAt: t.createdAt,
    })));
    res.json({ data: result, total, skip, take });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const createTeacher = async (req: Request, res: Response) => {
  try {
    const v = validate(createTeacherSchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { designation, name, email, contact } = v.data;
    const parsed = parsePhoto(req.body);

    const teacher = await prisma.teacher.create({
      data: {
        designation,
        name,
        email: email || null,
        contact: contact || null,
      },
    });

    let photoUrl: string | null = null;
    if (parsed) {
      const { path, error } = await uploadPhoto(PHOTO_BUCKET, "teachers", teacher.id, parsed.buffer, parsed.mimeType);
      if (!error && path) {
        await prisma.teacher.update({ where: { id: teacher.id }, data: { photoPath: path } });
        photoUrl = await getSignedUrl(PHOTO_BUCKET, path);
      }
    }

    res.status(201).json({
      id: teacher.id,
      designation: teacher.designation,
      name: teacher.name,
      email: teacher.email,
      contact: teacher.contact,
      photoUrl,
      createdAt: teacher.createdAt,
    });
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const updateTeacher = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const v = validate(createTeacherSchema.partial(), req.body);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { designation, name, email, contact } = v.data;
    const parsed = parsePhoto(req.body);

    const data: any = {
      ...(designation !== undefined && { designation }),
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email: email || null }),
      ...(contact !== undefined && { contact: contact || null }),
    };

    const existing = await prisma.teacher.findUnique({ where: { id }, select: { photoPath: true } });

    if (parsed) {
      if (existing?.photoPath) await deletePhoto(PHOTO_BUCKET, existing.photoPath);
      const { path, error } = await uploadPhoto(PHOTO_BUCKET, "teachers", id, parsed.buffer, parsed.mimeType);
      if (!error && path) data.photoPath = path;
    } else if (req.body.clearPhoto === true && existing?.photoPath) {
      await deletePhoto(PHOTO_BUCKET, existing.photoPath);
      data.photoPath = null;
    }

    const teacher = await prisma.teacher.update({ where: { id }, data });
    res.json({
      id: teacher.id,
      designation: teacher.designation,
      name: teacher.name,
      email: teacher.email,
      contact: teacher.contact,
      photoUrl: teacher.photoPath ? await getSignedUrl(PHOTO_BUCKET, teacher.photoPath) : null,
      createdAt: teacher.createdAt,
    });
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const deleteTeacher = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.teacher.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json({ message: "Teacher deleted", id });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const restoreTeacher = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.teacher.update({ where: { id }, data: { deletedAt: null } });
    res.json({ message: "Teacher restored", id });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const getTeacherPhoto = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const teacher = await prisma.teacher.findUnique({ where: { id }, select: { photo: true, photoPath: true } });
    if (!teacher?.photo && !teacher?.photoPath) return res.status(404).json({ error: "Photo not found" });

    if (teacher.photoPath) {
      const url = await getSignedUrl(PHOTO_BUCKET, teacher.photoPath, 3600);
      if (url) return res.redirect(url);
    }

    if (!teacher.photo) return res.status(404).json({ error: "Photo not found" });
    const buf = Buffer.from(teacher.photo);
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

export const importStaff = async (req: Request, res: Response) => {
  try {
    const { staff } = req.body;
    if (!Array.isArray(staff) || staff.length === 0) {
      return res.status(400).json({ error: "Send { staff: [...] } with at least one staff member" });
    }
    if (staff.length > 500) return res.status(400).json({ error: "Maximum 500 per import" });

    const created: any[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < staff.length; i++) {
      const s = staff[i];
      if (!s.name || !s.role) {
        errors.push({ row: i + 1, error: !s.name ? "Name is required" : "Role is required" });
        continue;
      }
      try {
        const member = await prisma.staff.create({
          data: { role: s.role, name: s.name, email: s.email || null, contact: s.contact || null },
        });
        created.push({ id: member.id, name: member.name, role: member.role });
      } catch (e: any) {
        errors.push({ row: i + 1, error: sanitizeError(e) });
      }
    }

    logAudit({ action: "IMPORT", entityType: "Staff", entityId: `batch-${created.length}`, details: JSON.stringify({ created: created.length, errors: errors.length }) });
    res.status(201).json({ created: created.length, errors, staff: created });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const getAllStaff = async (req: Request, res: Response) => {
  try {
    const skip = Math.max(0, parseInt(String(req.query.skip || '0')));
    const take = Math.min(500, Math.max(1, parseInt(String(req.query.take || '200'))));
    const [staff, total] = await Promise.all([
      prisma.staff.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.staff.count({ where: { deletedAt: null } }),
    ]);
    const result = await Promise.all(staff.map(async (s) => ({
      id: s.id,
      role: s.role,
      name: s.name,
      email: s.email,
      contact: s.contact,
      photoUrl: s.photoPath ? await getSignedUrl(PHOTO_BUCKET, s.photoPath) : null,
      hasPhoto: !!(s.photoPath || s.photo),
      createdAt: s.createdAt,
    })));
    res.json({ data: result, total, skip, take });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const createStaff = async (req: Request, res: Response) => {
  try {
    const v = validate(createStaffSchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { role, name, email, contact } = v.data;
    const parsed = parsePhoto(req.body);

    const staff = await prisma.staff.create({
      data: {
        role,
        name,
        email: email || null,
        contact: contact || null,
      },
    });

    let photoUrl: string | null = null;
    if (parsed) {
      const { path, error } = await uploadPhoto(PHOTO_BUCKET, "staff", staff.id, parsed.buffer, parsed.mimeType);
      if (!error && path) {
        await prisma.staff.update({ where: { id: staff.id }, data: { photoPath: path } });
        photoUrl = await getSignedUrl(PHOTO_BUCKET, path);
      }
    }

    res.status(201).json({
      id: staff.id,
      role: staff.role,
      name: staff.name,
      email: staff.email,
      contact: staff.contact,
      photoUrl,
      createdAt: staff.createdAt,
    });
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const updateStaff = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const v = validate(createStaffSchema.partial(), req.body);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { role, name, email, contact } = v.data;
    const parsed = parsePhoto(req.body);

    const data: any = {
      ...(role !== undefined && { role }),
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email: email || null }),
      ...(contact !== undefined && { contact: contact || null }),
    };

    const existing = await prisma.staff.findUnique({ where: { id }, select: { photoPath: true } });

    if (parsed) {
      if (existing?.photoPath) await deletePhoto(PHOTO_BUCKET, existing.photoPath);
      const { path, error } = await uploadPhoto(PHOTO_BUCKET, "staff", id, parsed.buffer, parsed.mimeType);
      if (!error && path) data.photoPath = path;
    } else if (req.body.clearPhoto === true && existing?.photoPath) {
      await deletePhoto(PHOTO_BUCKET, existing.photoPath);
      data.photoPath = null;
    }

    const staff = await prisma.staff.update({ where: { id }, data });
    res.json({
      id: staff.id,
      role: staff.role,
      name: staff.name,
      email: staff.email,
      contact: staff.contact,
      photoUrl: staff.photoPath ? await getSignedUrl(PHOTO_BUCKET, staff.photoPath) : null,
      createdAt: staff.createdAt,
    });
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const deleteStaff = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.staff.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json({ message: "Staff deleted", id });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const restoreStaff = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.staff.update({ where: { id }, data: { deletedAt: null } });
    res.json({ message: "Staff restored", id });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const getStaffPhoto = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const staff = await prisma.staff.findUnique({ where: { id }, select: { photo: true, photoPath: true } });
    if (!staff?.photo && !staff?.photoPath) return res.status(404).json({ error: "Photo not found" });

    if (staff.photoPath) {
      const url = await getSignedUrl(PHOTO_BUCKET, staff.photoPath, 3600);
      if (url) return res.redirect(url);
    }

    if (!staff.photo) return res.status(404).json({ error: "Photo not found" });
    const buf = Buffer.from(staff.photo);
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

// ── Books ──

export const getAllBooks = async (req: Request, res: Response) => {
  try {
    const skip = Math.max(0, parseInt(String(req.query.skip || '0')));
    const take = Math.min(500, Math.max(1, parseInt(String(req.query.take || '200'))));
    const [books, total] = await Promise.all([
      prisma.book.findMany({
        include: { class: { select: { id: true, name: true } } },
        orderBy: { name: "asc" },
        skip,
        take,
      }),
      prisma.book.count(),
    ]);
    res.json({ data: books, total, skip, take });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const createBook = async (req: Request, res: Response) => {
  try {
    const v = validate(createBookSchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { name, publication, mrp, discounted, sell, classId } = v.data;

    const cls = await prisma.schoolClass.findUnique({ where: { id: classId } });
    if (!cls) return res.status(400).json({ error: "Invalid classId" });

    const book = await prisma.book.create({
      data: {
        name,
        publication: publication || null,
        mrp: Number(mrp) || 0,
        discounted: Number(discounted) || 0,
        sell: Number(sell) || 0,
        classId,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    res.status(201).json(book);
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const updateBook = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const v = validate(createBookSchema.partial(), req.body);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { name, publication, mrp, discounted, sell, classId } = v.data;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (publication !== undefined) data.publication = publication || null;
    if (mrp !== undefined) data.mrp = Number(mrp);
    if (discounted !== undefined) data.discounted = Number(discounted);
    if (sell !== undefined) data.sell = Number(sell);
    if (classId !== undefined) data.classId = classId;

    const book = await prisma.book.update({
      where: { id },
      data,
      include: { class: { select: { id: true, name: true } } },
    });

    res.json(book);
  } catch (error: any) {
    res.status(errorStatus(error)).json({ error: sanitizeError(error) });
  }
};

export const deleteBook = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.book.delete({ where: { id } });
    res.json({ message: "Book deleted" });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};
