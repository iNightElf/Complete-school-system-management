import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { handleControllerError } from "../lib/errors.js";

let cache: { data: any[]; ts: number } | null = null;
const TTL = 60_000;

export function invalidateAcademicYearsCache() { cache = null; }

export const getAcademicYears = async (_req: Request, res: Response) => {
  try {
    if (cache && Date.now() - cache.ts < TTL) {
      return res.json(cache.data);
    }
    const years = await prisma.academicYear.findMany({ orderBy: { startDate: "desc" }, take: 100 });
    cache = { data: years, ts: Date.now() };
    res.json(years);
  } catch (error: any) {
    handleControllerError(res, error, _req.path);
  }
};

export const createAcademicYear = async (req: Request, res: Response) => {
  try {
    const { name, startDate, endDate, isActive } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: "name, startDate, and endDate are required" });
    }
    const existing = await prisma.academicYear.findUnique({ where: { name } });
    if (existing) return res.status(409).json({ error: "Academic year with this name already exists" });
    if (isActive) {
      await prisma.academicYear.updateMany({ where: { isActive: true }, data: { isActive: false } });
    }
    const year = await prisma.academicYear.create({ data: { name, startDate: new Date(startDate), endDate: new Date(endDate), isActive: !!isActive } });
    invalidateAcademicYearsCache();
    res.status(201).json(year);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const updateAcademicYear = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { name, startDate, endDate, isActive } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = new Date(endDate);
    if (isActive !== undefined) {
      if (isActive) {
        await prisma.academicYear.updateMany({ where: { isActive: true }, data: { isActive: false } });
      }
      data.isActive = isActive;
    }
    const year = await prisma.academicYear.update({ where: { id }, data });
    invalidateAcademicYearsCache();
    res.json(year);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};