import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { param } from "../lib/param.js";

const prisma = new PrismaClient();

function parsePhoto(body: any): Buffer | null {
  if (!body.photo) return null;
  if (typeof body.photo === "string" && body.photo.startsWith("data:image")) {
    const base64 = body.photo.split(",")[1];
    return Buffer.from(base64, "base64");
  }
  return null;
}

// ── Teachers ──

export const getAllTeachers = async (req: Request, res: Response) => {
  try {
    const teachers = await prisma.teacher.findMany({ orderBy: { createdAt: "desc" } });
    const result = teachers.map((t) => ({
      ...t,
      photo: t.photo ? `data:image/jpeg;base64,${Buffer.from(t.photo).toString("base64")}` : null,
    }));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createTeacher = async (req: Request, res: Response) => {
  try {
    const { designation, name, email, contact } = req.body;
    const photoBuffer = parsePhoto(req.body);

    const teacher = await prisma.teacher.create({
      data: {
        designation,
        name,
        email: email || null,
        contact: contact || null,
        photo: photoBuffer,
      },
    });

    res.status(201).json({ ...teacher, photo: null });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateTeacher = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const { designation, name, email, contact } = req.body;
    const photoBuffer = parsePhoto(req.body);

    const data: any = {
      ...(designation !== undefined && { designation }),
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email: email || null }),
      ...(contact !== undefined && { contact: contact || null }),
    };
    if (photoBuffer) data.photo = photoBuffer;

    const teacher = await prisma.teacher.update({ where: { id }, data });
    res.json({ ...teacher, photo: teacher.photo ? `data:image/jpeg;base64,${Buffer.from(teacher.photo).toString("base64")}` : null });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteTeacher = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.teacher.delete({ where: { id } });
    res.json({ message: "Teacher deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTeacherPhoto = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const teacher = await prisma.teacher.findUnique({ where: { id }, select: { photo: true } });
    if (!teacher?.photo) return res.status(404).json({ error: "Photo not found" });

    res.set("Content-Type", "image/jpeg");
    res.send(Buffer.from(teacher.photo));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ── Staff ──

export const getAllStaff = async (req: Request, res: Response) => {
  try {
    const staff = await prisma.staff.findMany({ orderBy: { createdAt: "desc" } });
    const result = staff.map((s) => ({
      ...s,
      photo: s.photo ? `data:image/jpeg;base64,${Buffer.from(s.photo).toString("base64")}` : null,
    }));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createStaff = async (req: Request, res: Response) => {
  try {
    const { role, name, email, contact } = req.body;
    const photoBuffer = parsePhoto(req.body);

    const staff = await prisma.staff.create({
      data: {
        role,
        name,
        email: email || null,
        contact: contact || null,
        photo: photoBuffer,
      },
    });

    res.status(201).json({ ...staff, photo: null });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateStaff = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const { role, name, email, contact } = req.body;
    const photoBuffer = parsePhoto(req.body);

    const data: any = {
      ...(role !== undefined && { role }),
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email: email || null }),
      ...(contact !== undefined && { contact: contact || null }),
    };
    if (photoBuffer) data.photo = photoBuffer;

    const staff = await prisma.staff.update({ where: { id }, data });
    res.json({ ...staff, photo: staff.photo ? `data:image/jpeg;base64,${Buffer.from(staff.photo).toString("base64")}` : null });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteStaff = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.staff.delete({ where: { id } });
    res.json({ message: "Staff deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getStaffPhoto = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const staff = await prisma.staff.findUnique({ where: { id }, select: { photo: true } });
    if (!staff?.photo) return res.status(404).json({ error: "Photo not found" });

    res.set("Content-Type", "image/jpeg");
    res.send(Buffer.from(staff.photo));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ── Books ──

export const getAllBooks = async (req: Request, res: Response) => {
  try {
    const books = await prisma.book.findMany({
      include: { class: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    res.json(books);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createBook = async (req: Request, res: Response) => {
  try {
    const { name, publication, mrp, discounted, sell, classId } = req.body;

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
    res.status(400).json({ error: error.message });
  }
};

export const updateBook = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const { name, publication, mrp, discounted, sell, classId } = req.body;

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
    res.status(400).json({ error: error.message });
  }
};

export const deleteBook = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.book.delete({ where: { id } });
    res.json({ message: "Book deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
