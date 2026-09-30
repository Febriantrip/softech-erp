import { useCallback, useEffect, useState } from 'react';
import { useCoreScope } from './useCoreWorkspace';
import { financeApi, type FinanceBootstrap } from '../api/finance';
import type { CoreScope } from '../api/core';

export function useFinanceBootstrap() {
  const { org, scope } = useCoreScope();
  const [data,setData]=useState<FinanceBootstrap|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const refresh=useCallback(async()=>{if(!scope){setData(null);setError('Pilih legal entity untuk membuka finance API.');return;}setLoading(true);setError('');try{setData(await financeApi.bootstrap(scope));}catch(err){setError((err as Error).message);}finally{setLoading(false);}},[scope?.entityCode,scope?.siteCode]);
  useEffect(()=>{void refresh();},[refresh]);
  return {org,scope,data,loading,error,refresh};
}

export function useFinanceList<T>(loader:(scope:CoreScope)=>Promise<T[]>) {
  const { org, scope } = useCoreScope();
  const [rows,setRows]=useState<T[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const refresh=useCallback(async()=>{if(!scope){setRows([]);setError('Pilih legal entity untuk membuka finance API.');return;}setLoading(true);setError('');try{setRows(await loader(scope));}catch(err){setRows([]);setError((err as Error).message);}finally{setLoading(false);}},[scope?.entityCode,scope?.siteCode,loader]);
  useEffect(()=>{void refresh();},[refresh]);
  return {org,scope,rows,loading,error,refresh};
}
