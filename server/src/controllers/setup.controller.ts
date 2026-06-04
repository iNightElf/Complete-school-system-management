import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { timingSafeEqual } from "crypto";
import { createAdminUser } from "../lib/supabase-auth.js";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const adminClient = () => {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, { realtime: { transport: ws as any } });
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
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ error: "Password must contain at least one uppercase letter" });
    }
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({ error: "Password must contain at least one lowercase letter" });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: "Password must contain at least one digit" });
    }

    const hasAdmin = await hasValidAdmin();
    const setupToken = process.env.SETUP_TOKEN;
    const role = hasAdmin ? "viewer" : "admin";

    // In production, a SETUP_TOKEN must be configured to allow any registration.
    if (process.env.NODE_ENV === 'production' && !setupToken) {
      return res.status(403).json({ error: "Setup is not configured. Ask the server administrator to set SETUP_TOKEN." });
    }

    // Creating the first admin requires the setup token.
    // Subsequent registrations create viewers and do not need a token.
    if (!hasAdmin) {
      if (!token) {
        return res.status(400).json({ error: "Setup token is required to create the first admin." });
      }
      const tokenBuf = Buffer.from(String(token));
      const setupBuf = Buffer.from(setupToken!);
      const maxLen = Math.max(tokenBuf.length, setupBuf.length);
      const paddedToken = Buffer.alloc(maxLen, tokenBuf);
      const paddedSetup = Buffer.alloc(maxLen, setupBuf);
      const valid = timingSafeEqual(paddedToken, paddedSetup);
      if (!valid) {
        return res.status(403).json({ error: "Invalid setup token" });
      }
    }

    // Clean up orphaned DB & Supabase Auth records for this email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    const client = adminClient();

    if (existingUser) {
      if (client) {
        const { data: authUser } = await client.auth.admin.getUserById(existingUser.id);
        if (authUser?.user) {
          return res.status(409).json({ error: "A user with this email already exists" });
        }
      }
      await prisma.user.delete({ where: { id: existingUser.id } }).catch(() => {});
    }

    // Check if email is already registered in Supabase Auth (orphaned)
    if (client) {
      // listUsers is O(n) but this runs only during registration, not on every request
      const { data: users, error: listErr } = await client.auth.admin.listUsers({ page: 1, perPage: 10000 });
      if (listErr) console.error("[setup] listUsers error:", listErr);
      const orphaned = users?.users?.find(u => u.email === email);
      if (orphaned) {
        const { error: delErr } = await client.auth.admin.deleteUser(orphaned.id);
        if (delErr) console.error("[setup] deleteUser error:", delErr);
      }
    }

    const supabaseUser = await createAdminUser(email, password, name);
    if (!supabaseUser) {
      return res.status(500).json({ error: "Failed to create user in Supabase Auth" });
    }

    // Update role to viewer if admin already exists
    if (role === "viewer") {
      await prisma.user.update({ where: { id: supabaseUser.id }, data: { role: "viewer" } });
    }

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
    console.error("[setup] initSetup error:", err?.message || err, err?.stack?.slice(0, 300));
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: "A user with this email already exists" });
    }
    res.status(500).json({ error: err?.message || "Failed to create user" });
  }
};
