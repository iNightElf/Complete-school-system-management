import type { Request, Response } from "express";
import { prisma } from "./prisma.js";

const TTL = 24 * 60 * 60 * 1000;

// Periodic cleanup of expired keys
setInterval(async () => {
  try {
    await prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch {
    // best-effort cleanup
  }
}, 60 * 60 * 1000);

export function idempotent(handler: (req: Request, res: Response) => any) {
  return async (req: Request, res: Response) => {
    const key = (req.headers["idempotency-key"] as string) || (req.body?.idempotencyKey as string);
    if (!key) return handler(req, res);

    try {
      const existing = await prisma.idempotencyKey.findUnique({ where: { id: key } });
      if (existing && existing.expiresAt > new Date()) {
        res.status(existing.status).json(existing.body as any);
        return;
      }

      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        prisma.idempotencyKey.upsert({
          where: { id: key },
          update: { status: res.statusCode, body: body as any, expiresAt: new Date(Date.now() + TTL) },
          create: { id: key, status: res.statusCode, body: body as any, expiresAt: new Date(Date.now() + TTL) },
        }).catch(() => {});
        return originalJson(body) as any;
      };

      return handler(req, res);
    } catch {
      return handler(req, res);
    }
  };
}
