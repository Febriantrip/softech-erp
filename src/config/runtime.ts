import type { DataMode } from '../types/platform';

const rawMode = String(import.meta.env.VITE_DATA_MODE || 'prototype').toLowerCase();

export const runtimeConfig = Object.freeze({
  apiBaseUrl: String(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1').replace(/\/$/, ''),
  dataMode: (rawMode === 'api' ? 'api' : 'prototype') as DataMode,
  isApiMode: rawMode === 'api',
});
