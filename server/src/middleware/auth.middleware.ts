import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth.js";
import { Permission, hasPermission } from "../lib/permissions.js";

export interface AuthRequest extends Request {
  session?: {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      emailVerified: boolean;
      image: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    session: {
      id: string;
      expiresAt: Date;
      token: string;
      ipAddress: string | null;
      userAgent: string | null;
      userId: string;
      createdAt: Date;
      updatedAt: Date;
    };
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as HeadersInit,
    });

    if (!session) {
      return res.status(401).json({ error: "Access denied" });
    }

    req.session = session as AuthRequest["session"];
    next();
  } catch {
    res.status(401).json({ error: "Invalid session" });
  }
};

export const authorizePermission = (...permissions: Permission[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.session) {
      return res.status(401).json({ error: "Access denied" });
    }
    const role = req.session.user.role;
    const allowed = permissions.some((p) => hasPermission(role, p));
    if (!allowed) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
};
