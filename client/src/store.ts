import { create } from 'zustand';
import axios from 'axios';

interface AuthState {
  token: string | null;
  role: string | null;
  user: any | null;
  setAuth: (token: string, role: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  role: localStorage.getItem('role'),
  user: null,
  setAuth: (token, role) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    set({ token, role });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    set({ token: null, role: null, user: null });
  },
}));

interface SchoolState {
  students: any[];
  teachers: any[];
  staff: any[];
  books: any[];
  results: any[];
  subjects: any[];
  transactions: any[];
  balances: any;
  fetchStudents: () => Promise<void>;
  fetchTeachers: () => Promise<void>;
  fetchStaff: () => Promise<void>;
  fetchFinance: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  fetchResults: (studentId: string) => Promise<void>;
  fetchSubjects: (classId: string) => Promise<void>;
}

const API_URL = 'http://localhost:5000/api';

export const useSchoolStore = create<SchoolState>((set, get) => ({
  students: [],
  teachers: [],
  staff: [],
  books: [],
  results: [],
  subjects: [],
  transactions: [],
  balances: { AL_RAWA_BANK: 0, GLOBAL_FORUM_BANK: 0, CASH_IN_HAND: 0 },
  fetchStudents: async () => {
    const token = useAuthStore.getState().token;
    const res = await axios.get(`${API_URL}/students`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    set({ students: res.data });
  },
  fetchTeachers: async () => {
    const token = useAuthStore.getState().token;
    const res = await axios.get(`${API_URL}/teachers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    set({ teachers: res.data });
  },
  fetchStaff: async () => {
    const token = useAuthStore.getState().token;
    const res = await axios.get(`${API_URL}/staff`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    set({ staff: res.data });
  },
  fetchBooks: async () => {
    const token = useAuthStore.getState().token;
    const res = await axios.get(`${API_URL}/books`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    set({ books: res.data });
  },
  fetchFinance: async () => {
    const token = useAuthStore.getState().token;
    const res = await axios.get(`${API_URL}/finance/balances`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    set({ balances: res.data });
  },
  fetchTransactions: async () => {
    const token = useAuthStore.getState().token;
    const res = await axios.get(`${API_URL}/finance/transactions`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    set({ transactions: res.data });
  },
  fetchResults: async (studentId: string) => {
    const token = useAuthStore.getState().token;
    const res = await axios.get(`${API_URL}/students/${studentId}/results`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    set({ results: res.data });
  },
  fetchSubjects: async (classId: string) => {
    const token = useAuthStore.getState().token;
    const res = await axios.get(`${API_URL}/classes/${classId}/subjects`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    set({ subjects: res.data });
  }
}));
