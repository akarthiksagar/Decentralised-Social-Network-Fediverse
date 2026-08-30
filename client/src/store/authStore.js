// src/store/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getDefaultServer, normalizeApiUrl } from '../lib/servers';

const defaultServer = getDefaultServer();

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      selectedServer: defaultServer,
      serverApiUrl: normalizeApiUrl(defaultServer.apiUrl),

      setServer: (server) =>
        set({
          selectedServer: server,
          serverApiUrl: normalizeApiUrl(server?.apiUrl),
        }),

      // Call this after login/register
      setAuth: (user, token, server = defaultServer) =>
        set({
          user,
          token,
          selectedServer: server,
          serverApiUrl: normalizeApiUrl(server?.apiUrl),
        }),

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
