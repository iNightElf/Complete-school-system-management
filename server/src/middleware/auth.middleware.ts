import { Request, Response, NextFunction } from "express";
import { getUserFromToken } from "../lib/supabase-auth.js";
import { Permission, hasPermission } from "../lib/permissions.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access denied" });
    }

    const token = authHeader.slice(7);
    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({ error: "Invalid session" });
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid session" });
  }
};

export const authorizePermission = (...permissions: Permission[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Access denied" });
    }
    const role = req.user.role;
    const allowed = permissions.some((p) => hasPermission(role, p));
    if (!allowed) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
};
