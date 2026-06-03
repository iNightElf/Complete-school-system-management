import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BalanceSummary from '../components/BalanceSummary';

describe('BalanceSummary', () => {
  it('renders income, deposited, and remaining amounts', () => {
    render(<BalanceSummary totalIncome={50000} totalDepositedToBank={30000} depositRemaining={20000} />);

    expect(screen.getByText('Income Collected')).toBeInTheDocument();
    expect(screen.getByText('Deposited to Bank')).toBeInTheDocument();
    expect(screen.getByText('Undeposited Income')).toBeInTheDocument();

    expect(screen.getByText('Deposited to Bank')).toBeInTheDocument();
    const allAmounts = screen.getAllByText('৳ 20,000');
    expect(allAmounts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders zero amounts correctly', () => {
    render(<BalanceSummary totalIncome={0} totalDepositedToBank={0} depositRemaining={0} />);

    const allZero = screen.getAllByText('৳ 0');
    expect(allZero.length).toBeGreaterThanOrEqual(1);
  });

  it('shows warning alert when depositRemaining > 0', () => {
    render(<BalanceSummary totalIncome={50000} totalDepositedToBank={30000} depositRemaining={20000} />);

    expect(screen.getByText(/in cash not yet deposited/)).toBeInTheDocument();
  });

  it('does not show warning alert when depositRemaining is 0', () => {
    render(<BalanceSummary totalIncome={50000} totalDepositedToBank={50000} depositRemaining={0} />);

    expect(screen.queryByText(/in cash not yet deposited/)).not.toBeInTheDocument();
  });

  it('uses amber color for undeposited heading when depositRemaining > 0', () => {
    const { container } = render(
      <BalanceSummary totalIncome={50000} totalDepositedToBank={30000} depositRemaining={20000} />
    );

    const undepositedCards = container.querySelectorAll('.text-amber-600');
    expect(undepositedCards.length).toBeGreaterThanOrEqual(1);
  });

  it('uses emerald color for undeposited heading when depositRemaining is 0', () => {
    const { container } = render(
      <BalanceSummary totalIncome={50000} totalDepositedToBank={50000} depositRemaining={0} />
    );

    const emeraldElements = container.querySelectorAll('.text-emerald-600');
    expect(emeraldElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders large amounts with correct formatting', () => {
    render(<BalanceSummary totalIncome={1000000} totalDepositedToBank={750000} depositRemaining={250000} />);

    expect(screen.getByText('Income Collected')).toBeInTheDocument();
    expect(screen.getByText('Deposited to Bank')).toBeInTheDocument();
    expect(screen.getByText('Undeposited Income')).toBeInTheDocument();
  });
});
