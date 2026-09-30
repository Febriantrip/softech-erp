import { runtimeConfig } from '../config/runtime';
import type { ApiErrorEnvelope } from '../types/platform';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 0, code = 'NETWORK_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface RequestOptions extends RequestInit {
  token?: string;
  entityId?: string;
  siteId?: string;
  idempotencyKey?: string;
  timeoutMs?: number;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.entityId) headers.set('X-Entity-ID', options.entityId);
  if (options.siteId) headers.set('X-Site-ID', options.siteId);
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);

  try {
    const response = await fetch(`${runtimeConfig.apiBaseUrl}${path}`, { ...options, headers, signal: controller.signal });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) {
      const errorPayload = payload as ApiErrorEnvelope | null;
      if (response.status === 401 && !path.startsWith('/auth/')) {
        window.dispatchEvent(new Event('softech:session-expired'));
      }
      throw new ApiError(errorPayload?.error?.message || `API request failed (${response.status})`, response.status, errorPayload?.error?.code || 'API_ERROR');
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error)?.name === 'AbortError') throw new ApiError('API request timed out', 0, 'TIMEOUT');
    throw new ApiError((error as Error)?.message || 'Unable to reach ERP API');
  } finally {
    window.clearTimeout(timeout);
  }
}
