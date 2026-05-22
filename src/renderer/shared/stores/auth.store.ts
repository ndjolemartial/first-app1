import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: number;
  uuid: string;
  matricule: string;
  firstName: string;
  lastName: string;
  email: string;
  login?: string | null;
  role: string;
  isActive: boolean;
  avatar?: string | null;
  phone?: string | null;
  mobile?: string | null;
  fonction?: string | null;
  idNumber?: string | null;
  civilite?: string | null;
  statutConjugal?: string | null;
  hireDate?: string | null;
  cnpsNumber?: string | null;
  residence?: string | null;
  theme?: string | null;
  lastLoginAt?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      updateUser: (patch) =>
        set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),
      clearAuth: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    { name: 'afrikimmo-auth' }
  )
);
