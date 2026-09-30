import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOrg } from '../context/OrgContext';
import { coreApi, type CoreBootstrap, type CoreScope } from '../api/core';

export function useCoreScope() {
  const org = useOrg();
  const scope = useMemo<CoreScope | null>(() => {
    if (org.groupMode || !org.entity?.code) return null;
    return { entityCode: org.entity.code, siteCode: org.site?.id === 'ALL' ? undefined : org.site?.code };
  }, [org.groupMode, org.entity?.code, org.site?.id, org.site?.code]);
  return { org, scope };
}

export function useCoreBootstrap() {
  const { org, scope } = useCoreScope();
  const [data, setData] = useState<CoreBootstrap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!scope) { setData(null); setError('Pilih legal entity, bukan Group Consolidated.'); return; }
    setLoading(true); setError('');
    try { setData(await coreApi.bootstrap(scope)); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, [scope?.entityCode, scope?.siteCode]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { org, scope, data, loading, error, refresh };
}

export function useCoreList<T>(loader: (scope: CoreScope) => Promise<T[]>) {
  const { org, scope } = useCoreScope();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!scope) { setRows([]); setError('Pilih legal entity, bukan Group Consolidated.'); return; }
    setLoading(true); setError('');
    try { setRows(await loader(scope)); }
    catch (err) { setRows([]); setError((err as Error).message); }
    finally { setLoading(false); }
  }, [scope?.entityCode, scope?.siteCode, loader]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { org, scope, rows, loading, error, refresh };
}
