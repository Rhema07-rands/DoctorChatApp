import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

type AuthState = {
  /** Whether the initial token check from SecureStore is complete */
  isHydrated: boolean;
  /** Whether a valid token + profile exist in SecureStore */
  isAuthenticated: boolean;
  /** The user's role derived from stored profile */
  userRole: 'doctor' | 'patient' | null;

  /** Call once on app start to read SecureStore and decide auth state */
  hydrate: () => Promise<void>;
  /** Mark the user as authenticated (called after login/register) */
  signIn: (role: 'doctor' | 'patient') => void;
  /** Clear auth state (called on logout) */
  signOut: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  isHydrated: false,
  isAuthenticated: false,
  userRole: null,

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const profileStr = await SecureStore.getItemAsync('userProfile');

      if (token && profileStr) {
        const user = JSON.parse(profileStr);
        const role = user.role?.toLowerCase() === 'doctor' ? 'doctor' : 'patient';
        set({ isAuthenticated: true, userRole: role as 'doctor' | 'patient', isHydrated: true });
      } else {
        set({ isAuthenticated: false, userRole: null, isHydrated: true });
      }
    } catch {
      set({ isAuthenticated: false, userRole: null, isHydrated: true });
    }
  },

  signIn: (role) => set({ isAuthenticated: true, userRole: role }),

  signOut: () => set({ isAuthenticated: false, userRole: null }),
}));
