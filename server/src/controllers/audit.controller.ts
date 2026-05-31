import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../middleware/auth.middleware.js";

export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'))));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (req.query.action) where.action = req.query.action;
    if (req.query.entityType) where.entityType = req.query.entityType;
    if (req.query.userId) where.userId = req.query.userId;
    if (req.query.dateFrom || req.query.dateTo) {
      where.createdAt = {};
      if (req.query.dateFrom) where.createdAt.gte = new Date(req.query.dateFrom as string);
      if (req.query.dateTo) where.createdAt.lte = new Date(req.query.dateTo as string);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ data: logs, total, page, limit });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
};

export const getAuditActions = async (_req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.auditLog.groupBy({
      by: ['action'],
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
    });
    res.json(result.map(r => ({ action: r.action, count: r._count.action })));
  } catch {
    res.status(500).json({ error: "Failed to fetch audit actions" });
  }
};

export const getAuditEntityTypes = async (_req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.auditLog.groupBy({
      by: ['entityType'],
      _count: { entityType: true },
      orderBy: { _count: { entityType: 'desc' } },
    });
    res.json(result.map(r => ({ entityType: r.entityType, count: r._count.entityType })));
  } catch {
    res.status(500).json({ error: "Failed to fetch audit entity types" });
  }
};
