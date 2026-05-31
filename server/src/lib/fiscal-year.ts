export const FISCAL_YEAR_START_MONTH = 8;

export function getFiscalYearForDate(date: Date): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  return month >= FISCAL_YEAR_START_MONTH ? year + 1 : year;
}

export function getFiscalYearRange(fiscalYear: number): { start: Date; end: Date } {
  const start = new Date(fiscalYear - 1, FISCAL_YEAR_START_MONTH, 1);
  const end = new Date(fiscalYear, FISCAL_YEAR_START_MONTH, 0, 23, 59, 59, 999);
  return { start, end };
}
