import { randomUUID } from "node:crypto";

export function requestIdMiddleware(req: any, res: any, next: any) {
  const requestId = randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

export function log(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  if (meta) {
    Object.assign(entry, meta);
  }
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}
