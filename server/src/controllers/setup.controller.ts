import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { timingSafeEqual } from "crypto";
import { createAdminUser, generateAndSendVerification } from "../lib/supabase-auth.js";
import { createClient } from "@supabase/supabase-js";

const adminClient = () => {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key);
};

async function hasValidAdmin(): Promise<boolean> {
  const dbAdmin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
  if (!dbAdmin) return false;
  const client = adminClient();
  if (!client) return false;
  const { data, error } = await client.auth.admin.getUserById(dbAdmin.id);
  return !error && !!data.user;
}

export const getSetupStatus = async (_req: Request, res: Response) => {
  try {
    const adminExists = await hasValidAdmin();
    res.json({ adminExists, setupTokenRequired: !!process.env.SETUP_TOKEN });
  } catch {
    res.status(500).json({ error: "Failed to check setup status" });
  }
};

export const initSetup = async (req: Request, res: Response) => {
  try {
    const { name, email, password, token } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, and password are required" });
    }

    const hasAdmin = await hasValidAdmin();
    const setupToken = process.env.SETUP_TOKEN;
    if (setupToken) {
      if (hasAdmin) {
        return res.status(400).json({ error: "System already has an admin. Setup is not required." });
      }
      if (!token) {
        return res.status(400).json({ error: "Setup token is required" });
      }
      const tokenBuf = Buffer.from(String(token));
      const setupBuf = Buffer.from(setupToken);
      const maxLen = Math.max(tokenBuf.length, setupBuf.length);
      const paddedToken = Buffer.alloc(maxLen, tokenBuf);
      const paddedSetup = Buffer.alloc(maxLen, setupBuf);
      const valid = timingSafeEqual(paddedToken, paddedSetup);
      if (!valid) {
        return res.status(403).json({ error: "Invalid setup token" });
      }
    }

    // Clean up orphaned DB record if Supabase Auth user doesn't exist
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const client = adminClient();
      if (client) {
        const { data: authUser } = await client.auth.admin.getUserById(existingUser.id);
        if (authUser?.user) {
          return res.status(409).json({ error: "A user with this email already exists" });
        }
      }
      await prisma.user.delete({ where: { id: existingUser.id } }).catch(() => {});
    }

    // Clean up orphaned Supabase Auth user if email already registered there
    const client = adminClient();
    if (client) {
      const { data: users } = await client.auth.admin.listUsers();
      const existing = users?.users?.find(u => u.email === email);
      if (existing) {
        await client.auth.admin.deleteUser(existing.id);
      }
    }

    const role = hasAdmin ? "viewer" : "admin";
    const supabaseUser = await createAdminUser(email, password, name);
    if (!supabaseUser) {
      return res.status(500).json({ error: "Failed to create user in Supabase Auth" });
    }

    // Update role to viewer if admin already exists
    if (role === "viewer") {
      await prisma.user.update({ where: { id: supabaseUser.id }, data: { role: "viewer" } });
    }

    // Send verification email (best-effort)
    generateAndSendVerification(email, password).catch(() => {});

    const user = await prisma.user.findUnique({
      where: { id: supabaseUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    res.json({ user, message: "User created successfully. You can now sign in." });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: "A user with this email already exists" });
    }
    res.status(500).json({ error: "Failed to create user" });
  }
};
