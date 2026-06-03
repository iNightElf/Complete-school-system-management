import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionForm from '../components/TransactionForm';

const mockOnSubmit = vi.fn();
const mockOnTabChange = vi.fn();

const mockClasses = [
  { id: 'c1', name: 'Class 1' },
  { id: 'c2', name: 'Class 2' },
];

const mockStudents = [
  { id: 's1', name: 'Alice', class: 'Class 1', fatherName: 'Mr. A', roll: '1' },
  { id: 's2', name: 'Bob', class: 'Class 1', fatherName: 'Mr. B', roll: '2' },
  { id: 's3', name: 'Charlie', class: 'Class 2', fatherName: null, roll: null },
];

const mockAccounts = [
  { id: 'AL_RAWA_BANK', label: 'AL RAWA Bank' },
  { id: 'CASH_IN_HAND', label: 'Cash in Hand' },
];

const mockExpenseCategories = ['Stationery', 'Utilities', 'Maintenance'];

describe('TransactionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields for income tab', () => {
    const { container } = render(
      <TransactionForm
        activeTab="income"
        onTabChange={mockOnTabChange}
        onSubmit={mockOnSubmit}
        classes={mockClasses}
        students={mockStudents}
        accounts={mockAccounts}
        expenseCategories={mockExpenseCategories}
      />
    );

    expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
    expect(container.querySelector('input[type="number"]')).toBeInTheDocument();
    expect(screen.getByText('Deposit To')).toBeInTheDocument();
    const classLabels = screen.getAllByText(/Class/);
    expect(classLabels.length).toBeGreaterThan(0);
  });

  it('switches between income/expense/transfer tabs', async () => {
    render(
      <TransactionForm
        activeTab="income"
        onTabChange={mockOnTabChange}
        onSubmit={mockOnSubmit}
      />
    );

    const expenseTab = screen.getByText('Expense');
    await userEvent.click(expenseTab);
    expect(mockOnTabChange).toHaveBeenCalledWith('expense');

    const transferTab = screen.getByText('Transfer');
    await userEvent.click(transferTab);
    expect(mockOnTabChange).toHaveBeenCalledWith('transfer');
  });

  it('shows expense-specific fields when activeTab is expense', () => {
    render(
      <TransactionForm
        activeTab="expense"
        onTabChange={mockOnTabChange}
        onSubmit={mockOnSubmit}
        expenseCategories={mockExpenseCategories}
      />
    );

    expect(screen.getByText('Pay From')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.queryByText('Deposit To')).not.toBeInTheDocument();
  });

  it('shows transfer-specific fields when activeTab is transfer', () => {
    render(
      <TransactionForm
        activeTab="transfer"
        onTabChange={mockOnTabChange}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
  });

  it('does not call onSubmit when form has validation errors', async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);
    const { container } = render(
      <TransactionForm
        activeTab="income"
        onTabChange={mockOnTabChange}
        onSubmit={mockOnSubmit}
        classes={mockClasses}
        students={mockStudents}
      />
    );

    const form = container.querySelector('form')!;
    fireEvent.submit(form);

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('validates same-account transfer', async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);
    const { container } = render(
      <TransactionForm
        activeTab="transfer"
        onTabChange={mockOnTabChange}
        onSubmit={mockOnSubmit}
        accounts={mockAccounts}
      />
    );

    const amountInput = container.querySelector('input[type="number"]')!;
    await userEvent.type(amountInput, '5000');

    const allCombos = screen.getAllByRole('combobox');
    await userEvent.selectOptions(allCombos[0], 'CASH_IN_HAND');
    await userEvent.selectOptions(allCombos[1], 'CASH_IN_HAND');

    const form = container.querySelector('form')!;
    fireEvent.submit(form);

    expect(mockOnSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Source and destination must be different')).toBeInTheDocument();
  });

  it('calls onSubmit with correct data when valid', async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);

    const { container } = render(
      <TransactionForm
        activeTab="expense"
        onTabChange={mockOnTabChange}
        onSubmit={mockOnSubmit}
        accounts={mockAccounts}
        expenseCategories={mockExpenseCategories}
      />
    );

    const dateInput = container.querySelector('input[type="date"]')!;
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, '2026-06-01');

    const amountInput = container.querySelector('input[type="number"]')!;
    await userEvent.type(amountInput, '2500');

    const combos = screen.getAllByRole('combobox');
    await userEvent.selectOptions(combos[0], 'CASH_IN_HAND');
    await userEvent.selectOptions(combos[1], 'Stationery');

    const form = container.querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
        date: '2026-06-01',
        amount: 2500,
        type: 'EXPENSE',
        sourceAccount: 'CASH_IN_HAND',
      }));
    });
  });

  it('shows loading state on submit button', () => {
    render(
      <TransactionForm
        activeTab="income"
        onTabChange={mockOnTabChange}
        onSubmit={mockOnSubmit}
        loading={true}
      />
    );

    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('shows class and student dropdowns for income tab when class is selected', async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);
    render(
      <TransactionForm
        activeTab="income"
        onTabChange={mockOnTabChange}
        onSubmit={mockOnSubmit}
        classes={mockClasses}
        students={mockStudents}
      />
    );

    const combos = screen.getAllByRole('combobox');
    await userEvent.selectOptions(combos[1], 'Class 1');

    expect(screen.getByText(/Select Student/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Alice/ })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Bob/ })).toBeInTheDocument();
    });
  });

  it('renders description field', () => {
    render(
      <TransactionForm
        activeTab="income"
        onTabChange={mockOnTabChange}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByPlaceholderText('Notes...')).toBeInTheDocument();
  });
});
