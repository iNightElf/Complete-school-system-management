import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LedgerTable from '../components/LedgerTable';

const mockEntries = [
  {
    id: '1',
    date: '2026-06-01',
    transactionType: 'INCOME',
    description: 'Tuition fee - John',
    debit: 5000,
    credit: 0,
    runningBalance: 5000,
  },
  {
    id: '2',
    date: '2026-06-02',
    transactionType: 'EXPENSE',
    description: 'Stationery',
    debit: 0,
    credit: 1200,
    runningBalance: 3800,
  },
  {
    id: '3',
    date: '2026-06-03',
    transactionType: 'INTERNAL_TRANSFER',
    description: 'Transfer to bank',
    debit: 0,
    credit: 2000,
    runningBalance: 1800,
  },
];

describe('LedgerTable', () => {
  it('renders table headers', () => {
    render(
      <LedgerTable
        entries={[]}
        accountLabel="Cash in Hand"
        openingBalance={0}
        closingBalance={0}
        totalDebits={0}
        totalCredits={0}
      />
    );

    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Debit (৳)')).toBeInTheDocument();
    expect(screen.getByText('Credit (৳)')).toBeInTheDocument();
    expect(screen.getByText('Balance (৳)')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <LedgerTable
        entries={[]}
        accountLabel="Cash in Hand"
        openingBalance={0}
        closingBalance={0}
        totalDebits={0}
        totalCredits={0}
        loading={true}
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByText('Loading entries...')).toBeInTheDocument();
  });

  it('renders account label', () => {
    render(
      <LedgerTable
        entries={[]}
        accountLabel="AL RAWA Bank"
        openingBalance={0}
        closingBalance={0}
        totalDebits={0}
        totalCredits={0}
      />
    );

    expect(screen.getByText('AL RAWA Bank Ledger')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(
      <LedgerTable
        entries={mockEntries}
        accountLabel="Cash in Hand"
        openingBalance={5000}
        closingBalance={1800}
        totalDebits={5000}
        totalCredits={3200}
      />
    );

    expect(screen.getByText('INCOME')).toBeInTheDocument();
    expect(screen.getByText('EXPENSE')).toBeInTheDocument();
    expect(screen.getByText('Transfer')).toBeInTheDocument();

    const all5000 = screen.getAllByText('5,000');
    expect(all5000.length).toBeGreaterThan(0);
    expect(screen.getByText('1,200')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    render(
      <LedgerTable
        entries={[]}
        accountLabel="Cash in Hand"
        openingBalance={0}
        closingBalance={0}
        totalDebits={0}
        totalCredits={0}
      />
    );

    expect(screen.getByText('No entries yet.')).toBeInTheDocument();
  });

  it('renders opening balance row', () => {
    render(
      <LedgerTable
        entries={mockEntries}
        accountLabel="Cash in Hand"
        openingBalance={10000}
        closingBalance={1800}
        totalDebits={5000}
        totalCredits={3200}
      />
    );

    expect(screen.getByText('Opening Balance')).toBeInTheDocument();
    expect(screen.getByText('10,000')).toBeInTheDocument();
  });

  it('renders total debits and credits in footer', () => {
    render(
      <LedgerTable
        entries={mockEntries}
        accountLabel="Cash in Hand"
        openingBalance={5000}
        closingBalance={1800}
        totalDebits={5000}
        totalCredits={3200}
      />
    );

    expect(screen.getByText(/Total Dr:/)).toBeInTheDocument();
    expect(screen.getByText(/Total Cr:/)).toBeInTheDocument();
    const closingElements = screen.getAllByText('1,800');
    expect(closingElements.length).toBeGreaterThan(0);
  });

  it('renders row count when not loading', () => {
    render(
      <LedgerTable
        entries={mockEntries}
        accountLabel="Cash in Hand"
        openingBalance={0}
        closingBalance={0}
        totalDebits={0}
        totalCredits={0}
        total={3}
      />
    );

    expect(screen.getByText('(3 rows)')).toBeInTheDocument();
  });

  it('renders pagination info when totalPages > 1', () => {
    render(
      <LedgerTable
        entries={mockEntries}
        accountLabel="Cash in Hand"
        openingBalance={0}
        closingBalance={0}
        totalDebits={0}
        totalCredits={0}
        total={10}
        page={2}
        totalPages={4}
      />
    );

    expect(screen.getByText('(10 rows, p.2/4)')).toBeInTheDocument();
  });

  it('does not show cancel column when canCancel is false', () => {
    render(
      <LedgerTable
        entries={mockEntries}
        accountLabel="Cash in Hand"
        openingBalance={0}
        closingBalance={0}
        totalDebits={0}
        totalCredits={0}
        canCancel={false}
      />
    );

    const cancelButtons = screen.queryAllByTitle('Cancel transaction');
    expect(cancelButtons).toHaveLength(0);
  });

  it('shows cancel buttons when canCancel is true and onCancel is provided', () => {
    const onCancel = vi.fn();
    render(
      <LedgerTable
        entries={mockEntries}
        accountLabel="Cash in Hand"
        openingBalance={0}
        closingBalance={0}
        totalDebits={0}
        totalCredits={0}
        canCancel={true}
        onCancel={onCancel}
      />
    );

    const buttons = screen.getAllByTitle('Cancel transaction');
    expect(buttons).toHaveLength(3);
    fireEvent.click(buttons[0]);
    expect(onCancel).toHaveBeenCalledWith('1');
  });
});
