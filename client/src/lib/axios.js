// src/lib/axios.js
import axios from 'axios';
import { normalizeApiUrl } from './servers';

const api = axios.create();

export function getActiveApiUrl() {
  try {
    const auth = localStorage.getItem('auth');
    if (!auth) return normalizeApiUrl();

    const parsedAuth = JSON.parse(auth);
    return normalizeApiUrl(parsedAuth?.state?.serverApiUrl || parsedAuth?.serverApiUrl);
  } catch {
    return normalizeApiUrl();
  }
}

// Before every request — attach the token automatically
api.interceptors.request.use((config) => {
  config.baseURL = normalizeApiUrl(config.baseURL || getActiveApiUrl());

  try {
    const auth = localStorage.getItem('auth');
    if (!auth) return config;

    const parsedAuth = JSON.parse(auth);
    const token = parsedAuth?.state?.token || parsedAuth?.token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    // Ignore invalid persisted auth and let the API return an auth error.
  }

  return config;
});

export default api;
