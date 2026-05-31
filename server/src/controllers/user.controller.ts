import { Response } from "express";
import { prisma } from "../lib/auth.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { ALL_ROLES, ROLE_LABELS, Role } from "../lib/permissions.js";

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { role } = req.body;

    if (!role || !ALL_ROLES.includes(role as Role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    if (id === req.session?.user.id) {
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

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update role" });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    if (id === req.session?.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.user.delete({ where: { id } });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user" });
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
