import type { Request, Response, NextFunction } from "express";

const cache = new Map<string, { status: number; body: any; ts: number }>();
const TTL = 24 * 60 * 60 * 1000;

// Periodic eviction of stale entries
setInterval(() => {
  const cutoff = Date.now() - TTL;
  for (const [key, entry] of cache) {
    if (entry.ts < cutoff) cache.delete(key);
  }
}, 60_000);

export function idempotent(handler: (req: Request, res: Response) => any) {
  return async (req: Request, res: Response) => {
    const key = (req.headers["idempotency-key"] as string) || (req.body?.idempotencyKey as string);
    if (!key) return handler(req, res);

    const existing = cache.get(key);
    if (existing && Date.now() - existing.ts < TTL) {
      res.status(existing.status).json(existing.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      cache.set(key, { status: res.statusCode, body, ts: Date.now() });
      return originalJson(body) as any;
    };

    return handler(req, res);
  };
}