// src/store/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,

      // Call this after login/register
      setAuth: (user, token) => set({ user, token }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : updates,
        })),

      // Call this on logout
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: 'auth', // saves to localStorage automatically
    }
  )
);
