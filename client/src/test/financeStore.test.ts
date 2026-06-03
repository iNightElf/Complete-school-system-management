import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSchoolStore, api } from '../store';

const defaultBalances = { AL_RAWA_BANK: 0, GLOBAL_FORUM_BANK: 0, CASH_IN_HAND: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  useSchoolStore.setState({
    balances: { ...defaultBalances },
    transactions: [],
    transactionTotal: 0,
    transactionPage: 1,
    transactionTotalPages: 1,
    dashboardSummary: { totalIncome: 0, totalDepositedToBank: 0, depositRemaining: 0 },
  });
});

describe('useSchoolStore — finance', () => {
  describe('initial state', () => {
    it('starts with zero balances', () => {
      const { balances } = useSchoolStore.getState();
      expect(balances).toEqual(defaultBalances);
    });

    it('starts with empty transactions', () => {
      const { transactions, transactionTotal } = useSchoolStore.getState();
      expect(transactions).toEqual([]);
      expect(transactionTotal).toBe(0);
    });

    it('starts with zero dashboardSummary', () => {
      const { dashboardSummary } = useSchoolStore.getState();
      expect(dashboardSummary).toEqual({ totalIncome: 0, totalDepositedToBank: 0, depositRemaining: 0 });
    });
  });

  describe('fetchFinance', () => {
    it('calls GET /finance/balances and updates balances', async () => {
      const mockBalances = { AL_RAWA_BANK: 1000, GLOBAL_FORUM_BANK: 500, CASH_IN_HAND: 200 };
      const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: mockBalances });

      await useSchoolStore.getState().fetchFinance();

      expect(getSpy).toHaveBeenCalledWith('/finance/balances');
      expect(useSchoolStore.getState().balances).toEqual(mockBalances);
    });

    it('sets loading flag', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({ data: {} });

      const promise = useSchoolStore.getState().fetchFinance();

      expect(useSchoolStore.getState().loading.finance).toBe(true);
      await promise;
      expect(useSchoolStore.getState().loading.finance).toBe(false);
    });

    it('handles error gracefully', async () => {
      vi.spyOn(api, 'get').mockRejectedValue(new Error('network error'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      await useSchoolStore.getState().fetchFinance();

      expect(useSchoolStore.getState().loading.finance).toBe(false);
    });
  });

  describe('fetchTransactions', () => {
    it('calls GET /finance/transactions and stores array response', async () => {
      const txData = [{ id: 't1', transactionType: 'INCOME', amount: 100 }];
      vi.spyOn(api, 'get').mockResolvedValue({ data: txData });

      await useSchoolStore.getState().fetchTransactions();

      expect(api.get).toHaveBeenCalledWith('/finance/transactions', { params: undefined });
      expect(useSchoolStore.getState().transactions).toEqual(txData);
    });

    it('handles paginated response with data property', async () => {
      const txData = [{ id: 't1', transactionType: 'INCOME', amount: 100 }];
      vi.spyOn(api, 'get').mockResolvedValue({ data: { data: txData, total: 50, page: 1, totalPages: 3 } });

      await useSchoolStore.getState().fetchTransactions({ type: 'INCOME' });

      expect(api.get).toHaveBeenCalledWith('/finance/transactions', { params: { type: 'INCOME' } });
      const state = useSchoolStore.getState();
      expect(state.transactions).toEqual(txData);
      expect(state.transactionTotal).toBe(50);
      expect(state.transactionPage).toBe(1);
      expect(state.transactionTotalPages).toBe(3);
    });

    it('sets loading flag for transactions', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({ data: [] });

      const promise = useSchoolStore.getState().fetchTransactions();

      expect(useSchoolStore.getState().loading.transactions).toBe(true);
      await promise;
      expect(useSchoolStore.getState().loading.transactions).toBe(false);
    });
  });

  describe('fetchDashboardSummary', () => {
    it('calls GET /finance/dashboard-summary and updates state', async () => {
      const summary = { totalIncome: 5000, totalDepositedToBank: 3000, depositRemaining: 2000 };
      const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: summary });

      await useSchoolStore.getState().fetchDashboardSummary('2025-2026');

      expect(getSpy).toHaveBeenCalledWith('/finance/dashboard-summary', { params: { fiscalYear: '2025-2026' } });
      expect(useSchoolStore.getState().dashboardSummary).toEqual(summary);
    });

    it('works without fiscalYear param', async () => {
      const summary = { totalIncome: 0, totalDepositedToBank: 0, depositRemaining: 0 };
      vi.spyOn(api, 'get').mockResolvedValue({ data: summary });

      await useSchoolStore.getState().fetchDashboardSummary();

      expect(api.get).toHaveBeenCalledWith('/finance/dashboard-summary', { params: { fiscalYear: undefined } });
    });

    it('handles error gracefully', async () => {
      vi.spyOn(api, 'get').mockRejectedValue(new Error('fail'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      await useSchoolStore.getState().fetchDashboardSummary();

      expect(useSchoolStore.getState().dashboardSummary).toEqual({ totalIncome: 0, totalDepositedToBank: 0, depositRemaining: 0 });
    });
  });

  describe('fee schedules and opening balances', () => {
    it('fetchFeeSchedules calls GET and stores result', async () => {
      const schedules = [{ id: 'fs1', category: 'TUITION', amount: 500 }];
      vi.spyOn(api, 'get').mockResolvedValue({ data: schedules });

      await useSchoolStore.getState().fetchFeeSchedules();

      expect(api.get).toHaveBeenCalledWith('/finance/fee-schedules');
      expect(useSchoolStore.getState().feeSchedules).toEqual(schedules);
    });

    it('fetchOpeningBalances calls GET with year param', async () => {
      const balances = { AL_RAWA_BANK: 100, CASH_IN_HAND: 50 };
      vi.spyOn(api, 'get').mockResolvedValue({ data: balances });

      await useSchoolStore.getState().fetchOpeningBalances('2025');

      expect(api.get).toHaveBeenCalledWith('/finance/opening-balances', { params: { year: '2025' } });
      expect(useSchoolStore.getState().openingBalances).toEqual(balances);
    });

    it('setOpeningBalances calls PUT then re-fetches', async () => {
      const putSpy = vi.spyOn(api, 'put').mockResolvedValue({ data: { ok: true } });
      vi.spyOn(api, 'get').mockResolvedValue({ data: { AL_RAWA_BANK: 200 } });

      const result = await useSchoolStore.getState().setOpeningBalances('2025', { AL_RAWA_BANK: 200 });

      expect(putSpy).toHaveBeenCalledWith('/finance/opening-balances', { year: '2025', balances: { AL_RAWA_BANK: 200 } });
      expect(result).toEqual({ ok: true });
      expect(useSchoolStore.getState().openingBalances).toEqual({ AL_RAWA_BANK: 200 });
    });
  });
});
