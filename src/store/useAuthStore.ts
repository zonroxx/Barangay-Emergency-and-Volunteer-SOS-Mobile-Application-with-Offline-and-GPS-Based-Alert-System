import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuthUser {
  uid: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  barangay: string;
  address: string;
  isAdmin: boolean;   // mirrors the Firestore users-doc isAdmin flag
  isActive: boolean;  // false = account deactivated by an admin
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  _hasHydrated: boolean;
  login: (user: AuthUser) => void;
  loginAsGuest: () => void;
  logout: () => void;
  setLoading: (v: boolean) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isGuest: false,
      isLoading: false,
      _hasHydrated: false,
      login: (user) => set({ user, isAuthenticated: true, isGuest: false }),
      loginAsGuest: () => set({ user: null, isAuthenticated: true, isGuest: true }),
      logout: () => set({ user: null, isAuthenticated: false, isGuest: false }),
      setLoading: (isLoading) => set({ isLoading }),
      setHasHydrated: (_hasHydrated) => set({ _hasHydrated }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isGuest: state.isGuest,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
