import { apiRequest, type RequestOptions } from './http';

export interface CommandEnvelope<T> {
  data: T;
  requestId?: string;
}

function commandOptions(options: RequestOptions = {}): RequestOptions {
  return {
    ...options,
    idempotencyKey: options.idempotencyKey || crypto.randomUUID(),
  };
}

// V10 defines the production API boundary. V11 will replace prototype/localStorage
// transaction mutations with typed calls through this client, module by module.
export const erpApi = {
  get: <T>(path: string, options?: RequestOptions) => apiRequest<T>(path, options),
  post: <TRequest, TResponse>(path: string, payload: TRequest, options?: RequestOptions) =>
    apiRequest<TResponse>(path, { ...commandOptions(options), method: 'POST', body: JSON.stringify(payload) }),
  patch: <TRequest, TResponse>(path: string, payload: TRequest, options?: RequestOptions) =>
    apiRequest<TResponse>(path, { ...commandOptions(options), method: 'PATCH', body: JSON.stringify(payload) }),
  delete: <TResponse>(path: string, options?: RequestOptions) =>
    apiRequest<TResponse>(path, { ...commandOptions(options), method: 'DELETE' }),
};
