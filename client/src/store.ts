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
    } catch {
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

  fetchClasses: () => Promise<void>;
  fetchStudents: () => Promise<void>;
  fetchTeachers: () => Promise<void>;
  fetchStaff: () => Promise<void>;
  fetchBooks: () => Promise<void>;
  fetchSubjects: (classId: string) => Promise<void>;
  fetchFinance: () => Promise<void>;
  fetchTransactions: () => Promise<void>;

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

  fetchClasses: async () => {
    try { const res = await api.get('/classes'); set({ classes: res.data }); } catch {}
  },
  fetchStudents: async () => {
    try { const res = await api.get('/students'); set({ students: res.data }); } catch {}
  },
  fetchTeachers: async () => {
    try { const res = await api.get('/teachers'); set({ teachers: res.data }); } catch {}
  },
  fetchStaff: async () => {
    try { const res = await api.get('/staff'); set({ staff: res.data }); } catch {}
  },
  fetchBooks: async () => {
    try { const res = await api.get('/books'); set({ books: res.data }); } catch {}
  },
  fetchSubjects: async (classId: string) => {
    try { const res = await api.get(`/classes/${classId}/subjects`); set({ subjects: res.data }); } catch {}
  },
  fetchFinance: async () => {
    try { const res = await api.get('/finance/balances'); set({ balances: res.data }); } catch {}
  },
  fetchTransactions: async () => {
    try { const res = await api.get('/finance/transactions'); set({ transactions: res.data }); } catch {}
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
    try { const res = await api.get('/users'); set({ users: res.data }); } catch {}
  },
  fetchRoles: async () => {
    try { const res = await api.get('/users/roles'); set({ roles: res.data }); } catch {}
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
