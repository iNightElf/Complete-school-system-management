import { describe, it, expect, vi, beforeEach } from "vitest";
import { requestIdMiddleware, log } from "../src/lib/logger.js";

describe("requestIdMiddleware", () => {
  it("sets a UUID requestId on res.locals and X-Request-Id header", () => {
    const req = {} as any;
    const res = { locals: {}, setHeader: vi.fn() } as any;
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(res.locals.requestId).toBeDefined();
    expect(typeof res.locals.requestId).toBe("string");
    expect(res.locals.requestId.length).toBeGreaterThan(0);
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-Id", res.locals.requestId);
    expect(next).toHaveBeenCalledOnce();
  });

  it("generates a different ID on each call", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const res = { locals: {}, setHeader: vi.fn() } as any;
      requestIdMiddleware({} as any, res, vi.fn());
      ids.add(res.locals.requestId);
    }
    expect(ids.size).toBe(100);
  });
});

describe("log", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("logs info level to console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("info", "test message");

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("test message");
    expect(parsed.timestamp).toBeDefined();
  });

  it("logs warn level to console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    log("warn", "warning message");

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.level).toBe("warn");
  });

  it("logs error level to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log("error", "error message");

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.level).toBe("error");
  });

  it("includes meta fields when provided", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("info", "with meta", { path: "/test", code: 200 });

    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.path).toBe("/test");
    expect(parsed.code).toBe(200);
    expect(parsed.message).toBe("with meta");
  });

  it("works without meta", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("info", "no meta");

    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.path).toBeUndefined();
  });
});
