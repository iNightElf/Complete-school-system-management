import type { Request, Response } from "express";
import { param } from "../lib/param.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError, errorStatus, handleControllerError } from "../lib/errors.js";

const MAX_CLASS_ORDER = 13; // Play(0) through Class 10(12), 13th slot = graduate

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
    handleControllerError(res, error, req.path);
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
    handleControllerError(res, error, req.path);
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
    handleControllerError(res, error, req.path);
  }
};

export const promoteAll = async (req: Request, res: Response) => {
  try {
    const { targetYearName, targetAcademicYearId } = req.body;
    if (!targetYearName) return res.status(400).json({ error: "targetYearName is required" });
    const dryRun = req.query.dryRun === 'true';

    const allClasses = await prisma.schoolClass.findMany({ orderBy: { order: 'asc' } });
    const allClassIds = allClasses.map(c => c.id);

    // Batch-fetch all data before the loop: O(1) queries instead of O(N) per class
    const allStudents = await prisma.student.findMany({
      where: { classId: { in: allClassIds }, deletedAt: null, graduatedAt: null, NOT: { session: targetYearName } },
    });
    const studentsByClass = new Map<string, typeof allStudents>();
    for (const s of allStudents) {
      if (!s.classId) continue;
      if (!studentsByClass.has(s.classId)) studentsByClass.set(s.classId, []);
      studentsByClass.get(s.classId)!.push(s);
    }

    const feesByClass = new Map<string, any[]>();
    const booksByClass = new Map<string, any[]>();
    const subjectsByClass = new Map<string, any[]>();
    if (targetAcademicYearId) {
      const allFees = await prisma.feeSchedule.findMany({
        where: { classId: { in: allClassIds }, academicYearId: targetAcademicYearId },
      });
      for (const f of allFees) {
        if (!f.classId) continue;
        if (!feesByClass.has(f.classId)) feesByClass.set(f.classId, []);
        feesByClass.get(f.classId)!.push(f);
      }
    }
    const allBooks = await prisma.book.findMany({ where: { classId: { in: allClassIds } } });
    for (const b of allBooks) {
      if (!booksByClass.has(b.classId)) booksByClass.set(b.classId, []);
      booksByClass.get(b.classId)!.push(b);
    }
    const allSubjects = await prisma.subject.findMany({ where: { classId: { in: allClassIds } } });
    for (const s of allSubjects) {
      if (!subjectsByClass.has(s.classId)) subjectsByClass.set(s.classId, []);
      subjectsByClass.get(s.classId)!.push(s);
    }

    const promoted: any[] = [];
    const graduated: any[] = [];
    const classesCreated: string[] = [];
    const errors: any[] = [];
    const promoteUpdates: { studentIds: string[]; nextClass: any }[] = [];
    const graduateUpdates: { studentIds: string[] }[] = [];

    const classByOrder = new Map(allClasses.map(c => [c.order, c]));

    for (const cls of allClasses) {
      const students = studentsByClass.get(cls.id) || [];
      if (students.length === 0) continue;

      let nextClass = classByOrder.get(cls.order + 1);
      let createdNew = false;

      if (!nextClass) {
        let nextName: string | null = null;

        const nameMatch = cls.name.match(/^Class\s+(\d+)$/i);
        if (nameMatch) {
          const num = parseInt(nameMatch[1], 10);
          if (num < 10) nextName = `Class ${num + 1}`;
        } else {
          const seq: Record<string, string> = {
            'play': 'Nursery', 'nursery': 'KG', 'kg': 'Class 1',
          };
          nextName = seq[cls.name.trim().toLowerCase()] || null;
        }

        if (nextName) {
          if (dryRun) {
            promoted.push({ from: cls.name, to: nextName, count: students.length, newClass: true });
            classesCreated.push(nextName);
            continue;
          }
          nextClass = await prisma.schoolClass.create({ data: { name: nextName, order: cls.order + 1 } });
          createdNew = true;
          classesCreated.push(nextName);

          // Copy fees, books, subjects using pre-fetched data
          const fees = feesByClass.get(cls.id) || [];
          if (fees.length > 0) {
            await prisma.feeSchedule.createMany({
              data: fees.map(f => ({
                academicYearId: targetAcademicYearId, classId: nextClass!.id,
                category: f.category, amount: f.amount, frequency: f.frequency, applicability: f.applicability,
              })),
            });
          }
          const books = booksByClass.get(cls.id) || [];
          if (books.length > 0) {
            await prisma.book.createMany({
              data: books.map(b => ({
                name: b.name, publication: b.publication, mrp: b.mrp,
                discounted: b.discounted, sell: b.sell, classId: nextClass!.id,
              })),
            });
          }
          const subjects = subjectsByClass.get(cls.id) || [];
          if (subjects.length > 0) {
            await prisma.subject.createMany({
              data: subjects.map(s => ({
                name: s.name, fullMarks: s.fullMarks, order: s.order, classId: nextClass!.id,
              })),
            });
          }
        } else {
          graduateUpdates.push({ studentIds: students.map(s => s.id) });
          if (!dryRun) {
            await prisma.student.updateMany({
              where: { id: { in: students.map(s => s.id) } },
              data: { graduatedAt: new Date(), session: targetYearName },
            });
          }
          graduated.push({ from: cls.name, count: students.length });
          continue;
        }
      }

      promoteUpdates.push({ studentIds: students.map(s => s.id), nextClass });
      if (!dryRun) {
        await prisma.student.updateMany({
          where: { id: { in: students.map(s => s.id) } },
          data: { classId: nextClass.id, class: nextClass.name, session: targetYearName },
        });
      }
      if (!createdNew) {
        promoted.push({ from: cls.name, to: nextClass.name, count: students.length, newClass: false });
      }
    }

    res.json({ promoted, graduated, classesCreated, errors, dryRun });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
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
    handleControllerError(res, error, req.path);
  }
};
