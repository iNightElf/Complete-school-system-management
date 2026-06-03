import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const mockIdempotencyKey = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn().mockResolvedValue(undefined as any),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    idempotencyKey: mockIdempotencyKey,
  },
}));

import { idempotent } from "../src/lib/idempotency.js";

function mockReq(headers: Record<string, string>, body?: any): Request {
  return { headers, body } as any;
}

function mockRes(): { res: Response; jsonSpy: ReturnType<typeof vi.fn> } {
  const jsonSpy = vi.fn();
  const res: any = { statusCode: 200 };
  res.status = vi.fn(() => res);
  res.json = jsonSpy;
  return { res, jsonSpy };
}

describe("idempotent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockIdempotencyKey.findUnique.mockResolvedValue(null);
  });

  it("calls handler when no idempotency key is present", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = idempotent(handler);
    const req = mockReq({});
    const { res } = mockRes();

    await wrapped(req, res);
    expect(handler).toHaveBeenCalledWith(req, res);
    expect(mockIdempotencyKey.findUnique).not.toHaveBeenCalled();
  });

  it("calls handler on first call with key", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = idempotent(handler);
    const req = mockReq({ "idempotency-key": "key-1" });
    const { res } = mockRes();

    await wrapped(req, res);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockIdempotencyKey.findUnique).toHaveBeenCalledWith({ where: { id: "key-1" } });
  });

  it("caches response and returns cached on subsequent identical key", async () => {
    const handler = vi.fn((_req: Request, _res: Response) => {
      _res.statusCode = 201;
      _res.json({ id: "created" });
    });
    const wrapped = idempotent(handler);
    const req1 = mockReq({ "idempotency-key": "key-2" });
    const { res: res1, jsonSpy: spy1 } = mockRes();

    await wrapped(req1, res1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(spy1).toHaveBeenCalledWith({ id: "created" });
    expect(mockIdempotencyKey.upsert).toHaveBeenCalledWith({
      where: { id: "key-2" },
      update: expect.objectContaining({ status: 201, body: { id: "created" } }),
      create: expect.objectContaining({ id: "key-2", status: 201, body: { id: "created" } }),
    });

    // Second call — cached response
    mockIdempotencyKey.findUnique.mockResolvedValueOnce({
      id: "key-2",
      status: 201,
      body: { id: "created" },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const req2 = mockReq({ "idempotency-key": "key-2" });
    const { res: res2, jsonSpy: spy2 } = mockRes();
    await wrapped(req2, res2);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledWith({ id: "created" });
    expect(res2.status).toHaveBeenCalledWith(201);
  });

  it("also accepts key from body.idempotencyKey", async () => {
    const handler = vi.fn((_req: Request, _res: Response) => {
      _res.json({ ok: true });
    });
    const wrapped = idempotent(handler);
    const req = mockReq({}, { idempotencyKey: "body-key" });
    const { res } = mockRes();

    await wrapped(req, res);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockIdempotencyKey.findUnique).toHaveBeenCalledWith({ where: { id: "body-key" } });
  });

  it("bypasses cache after TTL expires", async () => {
    const handler = vi.fn((_req: Request, _res: Response) => {
      _res.json({ ok: true });
    });
    const wrapped = idempotent(handler);
    const req1 = mockReq({ "idempotency-key": "key-3" });
    const { res: res1 } = mockRes();

    await wrapped(req1, res1);
    expect(handler).toHaveBeenCalledTimes(1);

    // Fast-forward past TTL — existing cached entry should be treated as expired
    const staleEntry = {
      id: "key-3",
      status: 200,
      body: { ok: true },
      expiresAt: new Date(Date.now() - 1000),
    };
    mockIdempotencyKey.findUnique.mockResolvedValue(staleEntry);

    const req2 = mockReq({ "idempotency-key": "key-3" });
    const { res: res2 } = mockRes();
    await wrapped(req2, res2);

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("returns cached even when key comes from header vs body interchangeably", async () => {
    const handler = vi.fn((_req: Request, _res: Response) => {
      _res.json({ ok: true });
    });
    const wrapped = idempotent(handler);
    const req1 = mockReq({ "idempotency-key": "shared-key" });
    const { res: res1 } = mockRes();
    await wrapped(req1, res1);
    expect(mockIdempotencyKey.upsert).toHaveBeenCalled();

    mockIdempotencyKey.findUnique.mockResolvedValueOnce({
      id: "shared-key",
      status: 200,
      body: { ok: true },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const req2 = mockReq({}, { idempotencyKey: "shared-key" });
    const { res: res2, jsonSpy: spy2 } = mockRes();
    await wrapped(req2, res2);

    expect(spy2).toHaveBeenCalledWith({ ok: true });
  });

  it("calls handler if DB read fails (graceful fallback)", async () => {
    mockIdempotencyKey.findUnique.mockRejectedValueOnce(new Error("DB unreachable"));

    const handler = vi.fn((_req: Request, _res: Response) => {
      _res.json({ ok: true });
    });
    const wrapped = idempotent(handler);
    const req = mockReq({ "idempotency-key": "key-4" });
    const { res } = mockRes();

    await wrapped(req, res);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
