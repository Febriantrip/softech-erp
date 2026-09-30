import { apiRequest } from './http';

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: { sub: string; name: string; roles: string[]; entities: string[]; sites: string[] };
}
export interface StoredSession {
  accessToken: string;
  expiresAt: number;
  user: LoginResponse['user'];
}
const SESSION_KEY = 'softech-erp-v12-real-account';
const LEGACY_KEY = 'nexa-erp-v11-api-session';

export function getApiSession(): StoredSession | null {
  try {
    // A browser session obtained using exposed VITE_BOOTSTRAP_* must NEVER be reused.
    sessionStorage.removeItem(LEGACY_KEY);
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') as StoredSession | null;
    if (!session?.accessToken || session.expiresAt <= Date.now() + 30_000) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch { return null; }
}
export function saveApiSession(response: LoginResponse): StoredSession {
  const session = {
    accessToken: response.accessToken,
    expiresAt: Date.now() + Math.max(0, Number(response.expiresIn) * 1000),
    user: response.user,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}
export function clearApiSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(LEGACY_KEY);
}
export async function ensureApiSession(): Promise<StoredSession> {
  const session = getApiSession();
  if (!session) throw new Error('Sesi berakhir. Silakan login kembali.');
  return session;
}
export const authApi = {
  password: (username: string, password: string) => apiRequest<LoginResponse>('/auth/login', {
    method: 'POST', body: JSON.stringify({ username, password }),
  }),
};
