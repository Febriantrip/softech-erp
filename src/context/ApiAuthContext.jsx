import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearApiSession, getApiSession, saveApiSession } from '../api/session';
import { runtimeConfig } from '../config/runtime';

const ApiAuthContext = createContext(null);
export function ApiAuthProvider({ children }) {
  const [session, setSession] = useState(() => runtimeConfig.isApiMode ? getApiSession() : null);
  const login = useCallback(response => setSession(saveApiSession(response)), []);
  const logout = useCallback(() => { clearApiSession(); setSession(null); }, []);
  useEffect(() => {
    if (!runtimeConfig.isApiMode) return undefined;
    window.addEventListener('softech:session-expired', logout);
    const onStorage = () => { if (!getApiSession()) logout(); };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('softech:session-expired', logout);
      window.removeEventListener('storage', onStorage);
    };
  }, [logout]);
  return <ApiAuthContext.Provider value={{ session, login, logout }}>{children}</ApiAuthContext.Provider>;
}
export function useApiAuth() {
  const value = useContext(ApiAuthContext);
  if (!value) throw new Error('ApiAuthProvider missing');
  return value;
}
