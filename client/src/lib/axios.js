// src/lib/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000'
});

// Before every request — attach the token automatically
api.interceptors.request.use((config) => {
  const auth = localStorage.getItem('auth');
  if (auth) {
    const parsedAuth = JSON.parse(auth);
    const token = parsedAuth?.state?.token || parsedAuth?.token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
