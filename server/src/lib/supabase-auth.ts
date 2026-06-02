import { createClient } from "@supabase/supabase-js";
import { prisma } from "./prisma.js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let adminClient: ReturnType<typeof createClient> | null = null;

function getAdmin() {
  if (!adminClient) {
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    adminClient = createClient(supabaseUrl, supabaseServiceKey);
  }
  return adminClient;
}

export async function getUserFromToken(accessToken: string) {
  const { data, error } = await getAdmin().auth.getUser(accessToken);
  if (error || !data.user) return null;
  const su = data.user;
  let dbUser = await prisma.user.findUnique({ where: { id: su.id } });
  if (!dbUser) {
    const name = (su.user_metadata?.name as string) || su.email?.split("@")[0] || "";
    dbUser = await prisma.user.create({
      data: {
        id: su.id,
        name,
        email: su.email || "",
        role: "viewer",
        emailVerified: !!su.email_confirmed_at,
      },
    });
  }
  return {
    id: su.id,
    email: su.email || "",
    name: dbUser.name,
    role: dbUser.role,
    emailVerified: !!su.email_confirmed_at,
    image: null as string | null,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
  };
}

export async function createAdminUser(email: string, password: string, name: string) {
  const { data, error } = await getAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { name },
  });
  if (error) throw error;
  if (data.user) {
    await prisma.user.upsert({
      where: { id: data.user.id },
      update: { name, email, role: "admin", emailVerified: false },
      create: { id: data.user.id, name, email, role: "admin", emailVerified: false },
    });
  }
  return data.user;
}

const APP_URL = process.env.BETTER_AUTH_URL || "http://localhost:5173";

export async function generateAndSendVerification(email: string, password: string) {
  const { data, error } = await getAdmin().auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { redirectTo: `${APP_URL}/verify-email` },
  });
  if (error) throw error;
  const link = data?.properties?.action_link;
  if (!link) throw new Error("No verification link returned");
  const { sendVerificationEmail } = await import("./email.js");
  await sendVerificationEmail(email, link);
  return link;
}

export async function updateUserRole(userId: string, role: string) {
  await getAdmin().auth.admin.updateUserById(userId, { user_metadata: { role } });
  await prisma.user.update({ where: { id: userId }, data: { role } });
}

export async function deleteAuthUser(userId: string) {
  // Supabase Auth delete is best-effort (user may not exist in Supabase)
  await getAdmin().auth.admin.deleteUser(userId).catch(() => {});
  await prisma.user.delete({ where: { id: userId } });
}
