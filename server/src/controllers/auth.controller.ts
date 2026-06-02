import { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";

export const getSession = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({ user: req.user });
};
