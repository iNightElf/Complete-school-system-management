import { describe, it, expect } from 'vitest';
import { fmt, getMonthName, getMonthNameShort, headwise } from '../lib/financeReportPdf';

describe('fmt', () => {
  it('formats a number with locale separators', () => {
    const result = fmt(1234567);
    expect(result).toBe('1,234,567');
  });

  it('formats zero', () => {
    expect(fmt(0)).toBe('0');
  });

  it('formats a small number', () => {
    expect(fmt(100)).toBe('100');
  });

  it('formats a decimal number', () => {
    const result = fmt(1234.56);
    expect(result).toContain('1,234');
  });

  it('formats negative numbers', () => {
    const result = fmt(-5000);
    expect(result).toBe('-5,000');
  });
});

describe('getMonthName', () => {
  it('returns January for month 0', () => {
    expect(getMonthName(0)).toBe('January');
  });

  it('returns December for month 11', () => {
    expect(getMonthName(11)).toBe('December');
  });

  it('returns correct names for all months', () => {
    const expected = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    expected.forEach((name, i) => {
      expect(getMonthName(i)).toBe(name);
    });
  });

  it('returns undefined for out-of-range month', () => {
    expect(getMonthName(12)).toBeUndefined();
  });
});

describe('getMonthNameShort', () => {
  it('returns Jan for month 0', () => {
    expect(getMonthNameShort(0)).toBe('Jan');
  });

  it('returns Dec for month 11', () => {
    expect(getMonthNameShort(11)).toBe('Dec');
  });

  it('returns correct short names for all months', () => {
    const expected = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    expected.forEach((name, i) => {
      expect(getMonthNameShort(i)).toBe(name);
    });
  });
});

describe('headwise', () => {
  it('groups transactions by category and sorts by amount descending', () => {
    const data = [
      { category: 'Tuition Fee', amount: 5000 },
      { category: 'Tuition Fee', amount: 3000 },
      { category: 'Stationery', amount: 2000 },
      { category: 'Transport', amount: 1000 },
    ];

    const result = headwise(data);

    expect(result).toEqual([
      ['Tuition Fee', 8000],
      ['Stationery', 2000],
      ['Transport', 1000],
    ]);
  });

  it('handles empty data', () => {
    const result = headwise([]);
    expect(result).toEqual([]);
  });

  it('categorises transactions with null category as Uncategorized', () => {
    const data = [
      { category: null, amount: 1000 },
      { category: null, amount: 500 },
      { category: 'Tuition', amount: 2000 },
    ];

    const result = headwise(data);

    expect(result).toEqual([
      ['Tuition', 2000],
      ['Uncategorized', 1500],
    ]);
  });

  it('handles single transaction', () => {
    const data = [{ category: 'Test', amount: 500 }];
    const result = headwise(data);
    expect(result).toEqual([['Test', 500]]);
  });

  it('handles string amounts', () => {
    const data = [
      { category: 'Fee', amount: '1000' },
      { category: 'Fee', amount: '500' },
    ];
    const result = headwise(data);
    expect(result).toEqual([['Fee', 1500]]);
  });

  it('sorts by amount descending even when order of insertion differs', () => {
    const data = [
      { category: 'A', amount: 100 },
      { category: 'B', amount: 500 },
      { category: 'C', amount: 300 },
    ];
    const result = headwise(data);
    expect(result[0][0]).toBe('B');
    expect(result[1][0]).toBe('C');
    expect(result[2][0]).toBe('A');
  });
});
