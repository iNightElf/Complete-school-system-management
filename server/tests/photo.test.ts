import { describe, it, expect } from "vitest";
import { detectMimeType, parsePhoto } from "../src/lib/photo.js";

function jpegBuffer(): Buffer {
  return Buffer.from([0xFF, 0xD8, 0xFF, 0x00, 0x01, 0x02]);
}

function pngBuffer(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01]);
}

function base64(buf: Buffer): string {
  return buf.toString("base64");
}

describe("detectMimeType", () => {
  it("detects JPEG from magic bytes", () => {
    expect(detectMimeType(jpegBuffer())).toBe("image/jpeg");
  });

  it("detects PNG from magic bytes", () => {
    expect(detectMimeType(pngBuffer())).toBe("image/png");
  });

  it("returns null for unknown format", () => {
    expect(detectMimeType(Buffer.from([0x00, 0x01, 0x02]))).toBeNull();
  });

  it("returns null for empty buffer", () => {
    expect(detectMimeType(Buffer.from([]))).toBeNull();
  });

  it("returns null for buffer shorter than magic bytes", () => {
    expect(detectMimeType(Buffer.from([0xFF, 0xD8]))).toBeNull();
  });
});

describe("parsePhoto", () => {
  it("returns null when body has no photo", () => {
    expect(parsePhoto({})).toBeNull();
  });

  it("returns null when photo is not a data URI string", () => {
    expect(parsePhoto({ photo: 123 })).toBeNull();
    expect(parsePhoto({ photo: "http://example.com/photo.jpg" })).toBeNull();
  });

  it("returns null for unsupported image extension", () => {
    expect(parsePhoto({ photo: "data:image/gif;base64,R0lGODdh" })).toBeNull();
  });

  it("returns null when base64 is malformed", () => {
    expect(parsePhoto({ photo: "data:image/jpeg;base64,!!!invalid!!!" })).toBeNull();
  });

  it("returns null when buffer is empty after decoding", () => {
    expect(parsePhoto({ photo: "data:image/jpeg;base64," })).toBeNull();
  });

  it("returns null when buffer exceeds max size", () => {
    const large = "data:image/jpeg;base64," + "A".repeat(600 * 1024);
    expect(parsePhoto({ photo: large })).toBeNull();
  });

  it("parses a valid JPEG photo successfully", () => {
    const buf = jpegBuffer();
    const dataUri = `data:image/jpeg;base64,${base64(buf)}`;
    const result = parsePhoto({ photo: dataUri });
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("image/jpeg");
    expect(result!.buffer).toEqual(buf);
  });

  it("parses a valid PNG photo successfully", () => {
    const buf = pngBuffer();
    const dataUri = `data:image/png;base64,${base64(buf)}`;
    const result = parsePhoto({ photo: dataUri });
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("image/png");
  });

  it("rejects data URI with wrong magic bytes", () => {
    const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xFF]); // valid JPEG start
    const wrongData = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    const dataUri = `data:image/jpeg;base64,${base64(wrongData)}`;
    expect(parsePhoto({ photo: dataUri })).toBeNull();
  });
});
