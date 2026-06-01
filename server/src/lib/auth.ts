import { betterAuth } from "better-auth";
import type { User } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.js";
import { sendVerificationEmail } from "./email.js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5173",
  trustedOrigins: process.env.TRUSTED_ORIGINS
    ? process.env.TRUSTED_ORIGINS.split(",").map(s => s.trim())
    : ["http://localhost:5173", "http://localhost:3000"],
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "viewer",
        required: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      const urlObj = new URL(url);
      const token = urlObj.searchParams.get("token");
      const callbackURL = urlObj.searchParams.get("callbackURL");
      const frontendUrl = `${process.env.BETTER_AUTH_URL}/verify-email?token=${token}${callbackURL ? `&callbackURL=${callbackURL}` : ""}`;

      await sendVerificationEmail(user.email, frontendUrl);
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // 1 day
  },
  advanced: {
    database: {
      generateId: () => {
        return crypto.randomUUID();
      },
      hooks: {
        user: {
          create: {
            before: async (user: User & Record<string, unknown>) => {
              const admin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
              if (!admin) {
                return { data: { ...user, role: "admin", emailVerified: true } };
              }
            },
          },
        },
      },
    },
  },
});

export { prisma };
