import axios from 'axios';
import { Capacitor } from '@capacitor/core';

/**
 * Web dev/production (same origin):  /api  → Vite proxy or Express static host
 * Capacitor bundled APK:            absolute URL (VITE_API_URL) — no relative /api
 */
function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv?.trim()) {
    return fromEnv.trim().replace(/\/$/, '');
  }

  if (import.meta.env.VITE_CAPACITOR_BUILD === 'true' || Capacitor.isNativePlatform()) {
    return 'https://megamtx.joelhalen.net/api';
  }

  return '/api';
}

const api = axios.create({ baseURL: resolveApiBaseUrl() });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
