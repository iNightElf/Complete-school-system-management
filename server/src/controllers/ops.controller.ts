import type { Request, Response } from "express";
import { createHash } from "crypto";
import { param } from "../lib/param.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError } from "../lib/errors.js";
import { validate, createTeacherSchema, createStaffSchema, createBookSchema } from "../lib/validate.js";
import { parsePhoto, detectMimeType } from "../lib/photo.js";

// ── Teachers ──

export const getAllTeachers = async (req: Request, res: Response) => {
  try {
    const skip = Math.max(0, parseInt(String(req.query.skip || '0')));
    const take = Math.min(500, Math.max(1, parseInt(String(req.query.take || '200'))));
    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
      prisma.teacher.count(),
    ]);
    const result = teachers.map((t) => ({
      id: t.id,
      designation: t.designation,
      name: t.name,
      email: t.email,
      contact: t.contact,
      hasPhoto: !!t.photo,
      createdAt: t.createdAt,
    }));
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
        photo: parsed?.buffer ?? null,
      },
    });

    res.status(201).json({ ...teacher, photo: null });
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
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
    if (parsed) data.photo = parsed.buffer;

    const teacher = await prisma.teacher.update({ where: { id }, data });
    res.json({ ...teacher, photo: undefined, hasPhoto: !!teacher.photo });
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};

export const deleteTeacher = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.teacher.delete({ where: { id } });
    res.json({ message: "Teacher deleted" });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const getTeacherPhoto = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const teacher = await prisma.teacher.findUnique({ where: { id }, select: { photo: true } });
    if (!teacher?.photo) return res.status(404).json({ error: "Photo not found" });

    const buf = Buffer.from(teacher.photo);
    const etag = createHash('md5').update(buf).digest('hex');
    if (req.headers['if-none-match'] === etag) { return res.status(304).end(); }
    res.set("Content-Type", detectMimeType(buf));
    res.set("Cache-Control", "public, max-age=86400");
    res.set("ETag", etag);
    res.send(buf);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

// ── Staff ──

export const getAllStaff = async (req: Request, res: Response) => {
  try {
    const skip = Math.max(0, parseInt(String(req.query.skip || '0')));
    const take = Math.min(500, Math.max(1, parseInt(String(req.query.take || '200'))));
    const [staff, total] = await Promise.all([
      prisma.staff.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
      prisma.staff.count(),
    ]);
    const result = staff.map((s) => ({
      id: s.id,
      role: s.role,
      name: s.name,
      email: s.email,
      contact: s.contact,
      hasPhoto: !!s.photo,
      createdAt: s.createdAt,
    }));
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
        photo: parsed?.buffer ?? null,
      },
    });

    res.status(201).json({ ...staff, photo: null });
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
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
    if (parsed) data.photo = parsed.buffer;

    const staff = await prisma.staff.update({ where: { id }, data });
    res.json({ ...staff, photo: undefined, hasPhoto: !!staff.photo });
  } catch (error: any) {
    res.status(400).json({ error: sanitizeError(error) });
  }
};

export const deleteStaff = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.staff.delete({ where: { id } });
    res.json({ message: "Staff deleted" });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const getStaffPhoto = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const staff = await prisma.staff.findUnique({ where: { id }, select: { photo: true } });
    if (!staff?.photo) return res.status(404).json({ error: "Photo not found" });

    const buf = Buffer.from(staff.photo);
    const etag = createHash('md5').update(buf).digest('hex');
    if (req.headers['if-none-match'] === etag) { return res.status(304).end(); }
    res.set("Content-Type", detectMimeType(buf));
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
    res.status(400).json({ error: sanitizeError(error) });
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
    res.status(400).json({ error: sanitizeError(error) });
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
