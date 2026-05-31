import { create } from 'zustand';
import axios from 'axios';

// ── API ──

const API_URL = '/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// ── Auth Store ──

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  fetchSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  fetchSession: async () => {
    try {
      const res = await api.get('/auth/get-session');
      set({ user: res.data?.user ?? null, loading: false });
    } catch (e) {
      console.error('[Auth] fetchSession failed:', e);
      set({ user: null, loading: false });
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/sign-out');
    } finally {
      set({ user: null });
    }
  },
}));

// ── Dark Mode ──
function getInitialDark(): boolean {
  const stored = localStorage.getItem('dark-mode');
  if (stored !== null) return stored === 'true';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const useDarkMode = create<{ dark: boolean; toggle: () => void }>((set, get) => ({
  dark: getInitialDark(),
  toggle: () => {
    const next = !get().dark;
    set({ dark: next });
    localStorage.setItem('dark-mode', String(next));
    document.documentElement.classList.toggle('dark', next);
  },
}));

useDarkMode.getState().dark
  ? document.documentElement.classList.add('dark')
  : document.documentElement.classList.remove('dark');

// ── UI Store (mode switching like old app) ──

type MainMode = null | 'idcard' | 'accessories' | 'result' | 'finance';
type IdSubMode = 'student' | 'teacher' | 'staff';

interface UIState {
  activeMode: MainMode;
  activeSubMode: IdSubMode;
  setMode: (mode: MainMode) => void;
  setIdSubMode: (sub: IdSubMode) => void;
  swipeBack: () => void;
  registerSwipeBack: (fn: () => void) => void;
}

let _swipeBackFn: (() => void) | null = null;

export const useUIStore = create<UIState>((set, get) => ({
  activeMode: null,
  activeSubMode: 'student',
  setMode: (mode) => set({ activeMode: mode }),
  setIdSubMode: (sub) => set({ activeSubMode: sub }),
  swipeBack: () => {
    const { activeMode, activeSubMode, setMode, setIdSubMode } = get();
    if (_swipeBackFn) {
      _swipeBackFn();
      _swipeBackFn = null;
      return;
    }
    if (activeMode === 'idcard' && activeSubMode !== 'student') {
      setIdSubMode('student');
    } else if (activeMode) {
      setMode(null);
    }
  },
  registerSwipeBack: (fn) => { _swipeBackFn = fn; },
}));

// ── School Store ──

interface ClassItem {
  id: string;
  name: string;
  order: number;
  studentCount: number;
  bookCount: number;
  subjectCount: number;
}

interface Subject {
  id: string;
  name: string;
  fullMarks: number;
  classId: string;
}

interface SchoolState {
  classes: ClassItem[];
  students: any[];
  teachers: any[];
  staff: any[];
  books: any[];
  subjects: Subject[];
  transactions: any[];
  balances: any;
  openingBalances: any;
  openingBalancesHistory: any[];
  studentTotal: number;
  teacherTotal: number;
  staffTotal: number;
  bookTotal: number;
  loading: { classes: boolean; students: boolean; teachers: boolean; staff: boolean; books: boolean; finance: boolean; transactions: boolean };

  fetchClasses: () => Promise<void>;
  fetchStudents: (params?: Record<string, string>) => Promise<void>;
  fetchTeachers: (params?: Record<string, string>) => Promise<void>;
  fetchStaff: (params?: Record<string, string>) => Promise<void>;
  fetchBooks: (params?: Record<string, string>) => Promise<void>;
  fetchSubjects: (classId: string) => Promise<void>;
  fetchFinance: () => Promise<void>;
  fetchTransactions: (params?: Record<string, string>) => Promise<void>;
  fetchOpeningBalances: (year?: string) => Promise<void>;
  setOpeningBalances: (year: string, balances: Record<string, number>) => Promise<any>;
  fetchOpeningBalanceHistory: (year?: string) => Promise<void>;
  revertOpeningBalance: (historyId: string) => Promise<void>;

  createClass: (name: string) => Promise<any>;
  deleteClass: (id: string) => Promise<void>;
  reorderClasses: (orderedIds: string[]) => Promise<void>;

  createSubject: (classId: string, name: string, fullMarks: number) => Promise<any>;
  updateSubject: (id: string, data: Partial<Subject>) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;

  saveStudentResult: (studentId: string, term: string, marks: any, attendance?: any, comment?: string) => Promise<void>;
  getStudentResults: (studentId: string) => Promise<any[]>;
}

export const useSchoolStore = create<SchoolState>((set, get) => ({
  classes: [],
  students: [],
  teachers: [],
  staff: [],
  books: [],
  subjects: [],
  transactions: [],
  balances: { AL_RAWA_BANK: 0, GLOBAL_FORUM_BANK: 0, CASH_IN_HAND: 0 },
  openingBalances: { AL_RAWA_BANK: 0, GLOBAL_FORUM_BANK: 0, CASH_IN_HAND: 0 },
  openingBalancesHistory: [],
  studentTotal: 0,
  teacherTotal: 0,
  staffTotal: 0,
  bookTotal: 0,
  loading: { classes: false, students: false, teachers: false, staff: false, books: false, finance: false, transactions: false },

  fetchClasses: async () => {
    set((s) => ({ loading: { ...s.loading, classes: true } }));
    try { const res = await api.get('/classes'); set({ classes: res.data }); } catch (e) { console.error('[Store] fetchClasses:', e); }
    finally { set((s) => ({ loading: { ...s.loading, classes: false } })); }
  },
  fetchStudents: async (params) => {
    set((s) => ({ loading: { ...s.loading, students: true } }));
    try { const res = await api.get('/students', { params }); set({ students: res.data.data || res.data, studentTotal: res.data.total ?? 0 }); } catch (e) { console.error('[Store] fetchStudents:', e); }
    finally { set((s) => ({ loading: { ...s.loading, students: false } })); }
  },
  fetchTeachers: async (params) => {
    set((s) => ({ loading: { ...s.loading, teachers: true } }));
    try { const res = await api.get('/teachers', { params }); set({ teachers: res.data.data || res.data, teacherTotal: res.data.total ?? 0 }); } catch (e) { console.error('[Store] fetchTeachers:', e); }
    finally { set((s) => ({ loading: { ...s.loading, teachers: false } })); }
  },
  fetchStaff: async (params) => {
    set((s) => ({ loading: { ...s.loading, staff: true } }));
    try { const res = await api.get('/staff', { params }); set({ staff: res.data.data || res.data, staffTotal: res.data.total ?? 0 }); } catch (e) { console.error('[Store] fetchStaff:', e); }
    finally { set((s) => ({ loading: { ...s.loading, staff: false } })); }
  },
  fetchBooks: async (params) => {
    set((s) => ({ loading: { ...s.loading, books: true } }));
    try { const res = await api.get('/books', { params }); set({ books: res.data.data || res.data, bookTotal: res.data.total ?? 0 }); } catch (e) { console.error('[Store] fetchBooks:', e); }
    finally { set((s) => ({ loading: { ...s.loading, books: false } })); }
  },
  fetchSubjects: async (classId: string) => {
    try { const res = await api.get(`/classes/${classId}/subjects`); set({ subjects: res.data }); } catch (e) { console.error('[Store] fetchSubjects:', e); }
  },
  fetchFinance: async () => {
    set((s) => ({ loading: { ...s.loading, finance: true } }));
    try { const res = await api.get('/finance/balances'); set({ balances: res.data }); } catch (e) { console.error('[Store] fetchFinance:', e); }
    finally { set((s) => ({ loading: { ...s.loading, finance: false } })); }
  },
  fetchTransactions: async (params?: Record<string, string>) => {
    set((s) => ({ loading: { ...s.loading, transactions: true } }));
    try { const res = await api.get('/finance/transactions', { params }); set({ transactions: res.data }); } catch (e) { console.error('[Store] fetchTransactions:', e); }
    finally { set((s) => ({ loading: { ...s.loading, transactions: false } })); }
  },

  fetchOpeningBalances: async (year) => {
    try { const res = await api.get('/finance/opening-balances', { params: { year } }); set({ openingBalances: res.data }); } catch (e) { console.error('[Store] fetchOpeningBalances:', e); }
  },
  setOpeningBalances: async (year, balances) => {
    const res = await api.put('/finance/opening-balances', { year, balances });
    await get().fetchOpeningBalances(year);
    return res.data;
  },
  fetchOpeningBalanceHistory: async (year) => {
    try { const res = await api.get('/finance/opening-balances/history', { params: { year } }); set({ openingBalancesHistory: res.data }); } catch (e) { console.error('[Store] fetchOpeningBalanceHistory:', e); }
  },
  revertOpeningBalance: async (historyId) => {
    await api.post(`/finance/opening-balances/revert/${historyId}`);
    await get().fetchOpeningBalances();
    await get().fetchOpeningBalanceHistory();
  },

  createClass: async (name: string) => {
    const res = await api.post('/classes', { name });
    await get().fetchClasses();
    return res.data;
  },
  deleteClass: async (id: string) => {
    await api.delete(`/classes/${id}`);
    await get().fetchClasses();
  },
  reorderClasses: async (orderedIds: string[]) => {
    await api.put('/classes/reorder', { orderedIds });
    await get().fetchClasses();
  },

  createSubject: async (classId: string, name: string, fullMarks: number) => {
    const res = await api.post(`/classes/${classId}/subjects`, { name, fullMarks });
    await get().fetchSubjects(classId);
    return res.data;
  },
  updateSubject: async (id: string, data: Partial<Subject>) => {
    await api.put(`/subjects/${id}`, data);
  },
  deleteSubject: async (id: string) => {
    await api.delete(`/subjects/${id}`);
  },

  saveStudentResult: async (studentId: string, term: string, marks: any, attendance?: any, comment?: string) => {
    await api.post(`/students/${studentId}/results`, { term, marks, attendance, ...(comment !== undefined && { comment }) });
  },
  getStudentResults: async (studentId: string) => {
    const res = await api.get(`/students/${studentId}/results`);
    return res.data;
  },
}));

// ── User Management Store (admin) ──

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
}

interface RoleOption {
  value: string;
  label: string;
}

interface UserManagementState {
  users: ManagedUser[];
  roles: RoleOption[];
  fetchUsers: () => Promise<void>;
  fetchRoles: () => Promise<void>;
  updateRole: (userId: string, role: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
}

export const useUserManagementStore = create<UserManagementState>((set, get) => ({
  users: [],
  roles: [],

  fetchUsers: async () => {
    try { const res = await api.get('/users'); set({ users: res.data }); } catch (e) { console.error('[Store] fetchUsers:', e); }
  },
  fetchRoles: async () => {
    try { const res = await api.get('/users/roles'); set({ roles: res.data }); } catch (e) { console.error('[Store] fetchRoles:', e); }
  },
  updateRole: async (userId: string, role: string) => {
    await api.put(`/users/${userId}/role`, { role });
    await get().fetchUsers();
  },
  deleteUser: async (userId: string) => {
    await api.delete(`/users/${userId}`);
    await get().fetchUsers();
  },
}));
