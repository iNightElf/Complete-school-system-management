import type { Response } from "express";
import { log } from "./logger.js";

const isDev = process.env.NODE_ENV !== 'production';

const PRISMA_MESSAGES: Record<string, string> = {
  P1001: 'Database is waking up. Please try again in a few seconds.',
  P2002: 'A record with that value already exists.',
  P2003: 'Related record not found.',
  P2025: 'Record not found.',
  P2014: 'Required relation violates constraint.',
  P2015: 'Related record not found.',
};

export function sanitizeError(error: any): string {
  if (!error) return 'Unknown error';

  if (error?.code && PRISMA_MESSAGES[error.code]) {
    let msg = PRISMA_MESSAGES[error.code];
    if (error.code === 'P2002' && error?.meta?.target) {
      msg = `A record with that ${error.meta.target.join(', ')} already exists.`;
    }
    return msg;
  }

  if (isDev) {
    return error?.message || error?.toString() || 'An internal error occurred.';
  }
  return 'An internal error occurred.';
}

export function errorStatus(error: any, defaultStatus = 400): number {
  return error?.code === 'P2025' ? 404 : defaultStatus;
}

export function handleControllerError(res: Response, error: any, path?: string) {
  log("error", error?.message || "Unknown error", {
    path,
    stack: isDev ? error?.stack : undefined,
    code: error?.code,
  });
  res.status(errorStatus(error)).json({ error: sanitizeError(error) });
}

export async function waitForDatabase(prisma: any, maxRetries = 10, delayMs = 2000): Promise<void> {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      return;
    } catch {
      if (i === maxRetries) throw new Error(`Database unreachable after ${maxRetries} attempts`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
