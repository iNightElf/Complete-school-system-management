import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// --- TEACHERS ---
export const getAllTeachers = async (req: Request, res: Response) => {
  try {
    const teachers = await prisma.teacher.findMany();
    res.json(teachers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createTeacher = async (req: Request, res: Response) => {
  try {
    const teacher = await prisma.teacher.create({ data: req.body });
    res.status(201).json(teacher);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// --- STAFF ---
export const getAllStaff = async (req: Request, res: Response) => {
  try {
    const staff = await prisma.staff.findMany();
    res.json(staff);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createStaff = async (req: Request, res: Response) => {
  try {
    const staff = await prisma.staff.create({ data: req.body });
    res.status(201).json(staff);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// --- BOOKS ---
export const getAllBooks = async (req: Request, res: Response) => {
  try {
    const books = await prisma.book.findMany({ include: { class: true } });
    res.json(books);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createBook = async (req: Request, res: Response) => {
  try {
    const book = await prisma.book.create({ data: req.body });
    res.status(201).json(book);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
