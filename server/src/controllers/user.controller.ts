import { Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { ALL_ROLES, ROLE_LABELS, Role } from "../lib/permissions.js";
import { updateUserRole as supabaseUpdateRole, deleteAuthUser as supabaseDeleteUser } from "../lib/supabase-auth.js";
import { handleControllerError } from "../lib/errors.js";

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const pageStr = req.query.page as string | undefined;
    const limitStr = req.query.limit as string | undefined;
    const page = pageStr ? Math.max(1, parseInt(pageStr, 10) || 1) : undefined;
    const limit = page ? Math.min(200, Math.max(1, parseInt(limitStr || '50', 10) || 50)) : undefined;
    if (page) {
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          select: { id: true, name: true, email: true, role: true, emailVerified: true, createdAt: true },
          orderBy: { createdAt: "asc" },
          skip: (page - 1) * limit!,
          take: limit!,
        }),
        prisma.user.count(),
      ]);
      return res.json({ data: users, total, page, totalPages: Math.ceil(total / limit!) });
    }
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, emailVerified: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 5000,
    });
    res.json(users);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { role } = req.body;

    if (!role || !ALL_ROLES.includes(role as Role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    if (id === req.user?.id) {
      return res.status(400).json({ error: "Cannot change your own role" });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    await supabaseUpdateRole(id, role).catch((e: any) => {
      console.error(`[userController] supabaseUpdateRole failed for ${id}: ${e?.message}`);
    });

    res.json(updated);
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    if (id === req.user?.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await supabaseDeleteUser(id);

    res.json({ success: true });
  } catch (error: any) {
    handleControllerError(res, error, req.path);
  }
};

export const getRoles = (_req: AuthRequest, res: Response) => {
  res.json(
    ALL_ROLES.map((r) => ({
      value: r,
      label: ROLE_LABELS[r],
    }))
  );
};
