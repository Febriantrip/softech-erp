import { useCallback, useEffect, useState } from 'react';
import { platformApi } from '../api/platform';
import type { LiveHealth, ReadyHealth } from '../types/platform';

export interface PlatformHealthState {
  loading: boolean;
  checkedAt: Date | null;
  live: LiveHealth | null;
  ready: ReadyHealth | null;
  error: string;
}

export function usePlatformHealth() {
  const [state, setState] = useState<PlatformHealthState>({ loading: true, checkedAt: null, live: null, ready: null, error: '' });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const live = await platformApi.live();
      let ready: ReadyHealth | null = null;
      try { ready = await platformApi.ready(); } catch (error) {
        ready = null;
        setState({ loading: false, checkedAt: new Date(), live, ready, error: (error as Error).message });
        return;
      }
      setState({ loading: false, checkedAt: new Date(), live, ready, error: '' });
    } catch (error) {
      setState({ loading: false, checkedAt: new Date(), live: null, ready: null, error: (error as Error).message });
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  return { ...state, refresh };
}
