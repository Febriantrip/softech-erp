import { apiRequest } from './http';
import type { LiveHealth, ReadyHealth } from '../types/platform';

export const platformApi = {
  live: () => apiRequest<LiveHealth>('/health/live', { timeoutMs: 2500 }),
  ready: () => apiRequest<ReadyHealth>('/health/ready', { timeoutMs: 4500 }),
};
