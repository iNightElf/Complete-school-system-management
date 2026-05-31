import type { Request, Response } from "express";
import { param } from "../lib/param.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError } from "../lib/errors.js";

export const getAllClasses = async (req: Request, res: Response) => {
  try {
    const [classes, studentCounts] = await Promise.all([
      prisma.schoolClass.findMany({
        orderBy: { order: "asc" },
        include: {
          _count: { select: { books: true, subjects: true } },
        },
      }),
      prisma.student.groupBy({ by: ["class"], _count: true }),
    ]);

    const countMap = Object.fromEntries(
      studentCounts.map((s) => [s.class, s._count])
    );

    const result = classes.map((cls) => ({
      id: cls.id,
      name: cls.name,
      order: cls.order,
      studentCount: countMap[cls.name] ?? 0,
      bookCount: cls._count.books,
      subjectCount: cls._count.subjects,
    }));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const createClass = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: "Class name is required" });
    }

    const maxOrder = await prisma.schoolClass.aggregate({ _max: { order: true } });
    const newClass = await prisma.schoolClass.create({
      data: {
        name: name.trim(),
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    res.status(201).json(newClass);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Class already exists" });
    }
    res.status(400).json({ error: sanitizeError(error) });
  }
};

export const deleteClass = async (req: Request, res: Response) => {
  try {
    const id = param(req, "id");
    const cls = await prisma.schoolClass.findUnique({ where: { id } });
    if (!cls) return res.status(404).json({ error: "Class not found" });

    await prisma.schoolClass.delete({ where: { id } });

    res.json({ message: "Class deleted" });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};

export const reorderClasses = async (req: Request, res: Response) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: "orderedIds array is required" });
    }

    await prisma.$transaction(
      orderedIds.map((id: string, index: number) =>
        prisma.schoolClass.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    res.json({ message: "Classes reordered" });
  } catch (error: any) {
    res.status(500).json({ error: sanitizeError(error) });
  }
};
