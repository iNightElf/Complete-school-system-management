import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { handleControllerError } from "../lib/errors.js";

export const getCategories = async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const where = type ? { type: type.toUpperCase() } : {};
    const cats = await prisma.category.findMany({ where, orderBy: { name: "asc" }, take: 1000 });
    res.json(cats);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { type, name } = req.body;
    if (!type || !name) return res.status(400).json({ error: "type and name are required" });
    const existing = await prisma.category.findUnique({ where: { type_name: { type: type.toUpperCase(), name } } });
    if (existing) return res.status(409).json({ error: "Category already exists" });
    const cat = await prisma.category.create({ data: { type: type.toUpperCase(), name } });
    res.status(201).json(cat);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const cat = await prisma.category.update({ where: { id }, data: { name } });
    res.json(cat);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await prisma.category.delete({ where: { id } });
    res.json({ message: "Category deleted" });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};