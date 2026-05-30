import type { Request, Response } from "express";
import { param } from "../lib/param.js";
import { prisma } from "../lib/prisma.js";

function parsePhoto(body: any): Buffer | null {
  if (!body.photo) return null;
  if (typeof body.photo === "string" && body.photo.startsWith("data:image")) {
    const base64 = body.photo.split(",")[1];
    return Buffer.from(base64, "base64");
  }
  return null;
}

export const getAllStudents = async (req: Request, res: Response) => {
  try {
    const students = await prisma.student.findMany({
      include: { results: true },
      orderBy: { createdAt: "desc" },
    });
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
      results: s.results,
    }));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createStudent = async (req: Request, res: Response) => {
  try {
    const { class: className, roll, name, fatherName, motherName, contact } = req.body;
    const photoBuffer = parsePhoto(req.body);

    const student = await prisma.student.create({
      data: {
        class: className,
        roll: roll || null,
        name,
        fatherName: fatherName || null,
        motherName: motherName || null,
        contact: contact || null,
        photo: photoBuffer,
      },
    });

    res.status(201).json({ ...student, photo: null });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateStudent = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const { class: className, roll, name, fatherName, motherName, contact } = req.body;
    const photoBuffer = parsePhoto(req.body);

    const data: any = {};
    if (className !== undefined) data.class = className;
    if (roll !== undefined) data.roll = roll || null;
    if (name !== undefined) data.name = name;
    if (fatherName !== undefined) data.fatherName = fatherName || null;
    if (motherName !== undefined) data.motherName = motherName || null;
    if (contact !== undefined) data.contact = contact || null;
    if (photoBuffer) data.photo = photoBuffer;

    const student = await prisma.student.update({
      where: { id },
      data,
      include: { results: true },
    });

    res.json({
      ...student,
      photo: undefined,
      hasPhoto: !!student.photo,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteStudent = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    await prisma.student.delete({ where: { id } });
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getStudentPhoto = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const student = await prisma.student.findUnique({ where: { id }, select: { photo: true } });
    if (!student?.photo) return res.status(404).json({ error: "Photo not found" });

    res.set("Content-Type", "image/jpeg");
    res.send(Buffer.from(student.photo));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
