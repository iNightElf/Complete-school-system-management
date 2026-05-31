import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import * as argon2 from "argon2";

export const getSetupStatus = async (_req: Request, res: Response) => {
  try {
    const admin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
    res.json({ adminExists: !!admin, setupTokenRequired: !!process.env.SETUP_TOKEN });
  } catch {
    res.status(500).json({ error: "Failed to check setup status" });
  }
};

export const initSetup = async (req: Request, res: Response) => {
  try {
    const existingAdmin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
    if (existingAdmin) {
      return res.status(400).json({ error: "System already has an admin. Setup is not required." });
    }

    const { name, email, password, token } = req.body;
    if (!name || !email || !password || !token) {
      return res.status(400).json({ error: "name, email, password, and token are required" });
    }

    const setupToken = process.env.SETUP_TOKEN;
    if (!setupToken) {
      return res.status(500).json({ error: "SETUP_TOKEN is not configured on the server" });
    }
    if (token !== setupToken) {
      return res.status(403).json({ error: "Invalid setup token" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "A user with this email already exists" });
    }

    const passwordHash = await argon2.hash(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role: "admin",
        emailVerified: true,
        account: {
          create: {
            accountId: email,
            providerId: "email",
            password: passwordHash,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    res.json({ user, message: "Admin user created successfully. You can now sign in." });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: "A user with this email already exists" });
    }
    res.status(500).json({ error: "Failed to create admin user" });
  }
};
