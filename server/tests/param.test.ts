import { describe, it, expect } from "vitest";
import { param } from "../src/lib/param.js";

function mockReq(params: Record<string, string | string[] | undefined>): any {
  return { params } as any;
}

describe("param", () => {
  it("returns string param as-is", () => {
    const req = mockReq({ id: "abc123" });
    expect(param(req, "id")).toBe("abc123");
  });

  it("returns first element when param is an array", () => {
    const req = mockReq({ id: ["first", "second"] });
    expect(param(req, "id")).toBe("first");
  });

  it("returns empty string when param is undefined", () => {
    const req = mockReq({});
    expect(param(req, "missing")).toBe("");
  });

  it("returns empty string when param is null", () => {
    const req = mockReq({ id: undefined as any });
    expect(param(req, "id")).toBe("");
  });
});
