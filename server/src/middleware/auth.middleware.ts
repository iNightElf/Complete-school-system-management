import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth.js";

export interface AuthRequest extends Request {
  session?: {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      emailVerified: Date;
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
      headers: req.headers,
    });

    if (!session) {
      return res.status(401).json({ error: "Access denied" });
    }

    req.session = session;
    next();
  } catch {
    res.status(401).json({ error: "Invalid session" });
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.session || !roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    next();
  };
};
