import type { Request } from "express";

/** Safely extract a single param as string (Express 5 types return string | string[]) */
export function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : (val ?? "");
}
