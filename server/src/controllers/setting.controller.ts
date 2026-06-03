import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeError, handleControllerError } from "../lib/errors.js";

const DEFAULT_SETTINGS: Record<string, string> = {
  school_name: "AL RAWA English School",
  address: "",
  phone: "",
  email: "",
  website: "",
};

export const getSettings = async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.schoolSetting.findMany();
    const settings = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (error: any) {
    handleControllerError(res, error, _req.path);
  }
};

export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as Record<string, string>;
    const allowed = Object.keys(DEFAULT_SETTINGS);
    const entries = Object.entries(body).filter(([k]) => allowed.includes(k));

    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.schoolSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    );

    const rows = await prisma.schoolSetting.findMany();
    const settings = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};
