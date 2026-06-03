import { describe, it, expect } from "vitest";
import {
  getFiscalYearForDate,
  getFiscalYearRange,
  FISCAL_YEAR_START_MONTH,
} from "../src/lib/fiscal-year.js";

describe("FISCAL_YEAR_START_MONTH", () => {
  it("is month index 8 (September)", () => {
    expect(FISCAL_YEAR_START_MONTH).toBe(8);
  });
});

describe("getFiscalYearForDate", () => {
  it("returns year+1 for dates in September or later", () => {
    expect(getFiscalYearForDate(new Date(2025, 8, 1))).toBe(2026);
    expect(getFiscalYearForDate(new Date(2025, 9, 15))).toBe(2026);
    expect(getFiscalYearForDate(new Date(2025, 11, 31))).toBe(2026);
  });

  it("returns the current year for dates before September", () => {
    expect(getFiscalYearForDate(new Date(2025, 0, 1))).toBe(2025);
    expect(getFiscalYearForDate(new Date(2025, 7, 31))).toBe(2025);
  });

  it("handles the exact boundary at September 1", () => {
    expect(getFiscalYearForDate(new Date(2025, 8, 1))).toBe(2026);
  });

  it("handles the day before September (August 31)", () => {
    expect(getFiscalYearForDate(new Date(2025, 7, 31))).toBe(2025);
  });
});

describe("getFiscalYearRange", () => {
  it("returns correct start and end for fiscal year 2026", () => {
    const { start, end } = getFiscalYearRange(2026);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(8);
    expect(start.getDate()).toBe(1);

    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(7);
    expect(end.getDate()).toBe(31);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
  });

  it("start is midnight for September 1", () => {
    const { start } = getFiscalYearRange(2025);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
  });

  it("end is last moment of August 31", () => {
    const { end } = getFiscalYearRange(2025);
    expect(end.getMonth()).toBe(7);
    expect(end.getDate()).toBe(31);
  });
});
