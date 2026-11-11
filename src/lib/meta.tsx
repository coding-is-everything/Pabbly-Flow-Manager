import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Meta } from './types';

interface MetaValue {
  meta: Meta | null;
  reloadMeta: () => void;
}

const MetaContext = createContext<MetaValue | null>(null);

/** Dashboard counts + folder/app/owner/tag lists, shared by filters and form autocomplete. */
export function MetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);

  const reloadMeta = useCallback(() => {
    api<Meta>('/meta').then(setMeta).catch(() => {});
  }, []);

  useEffect(() => {
    reloadMeta();
  }, [reloadMeta]);

  return <MetaContext.Provider value={{ meta, reloadMeta }}>{children}</MetaContext.Provider>;
}

export function useMeta(): MetaValue {
  const ctx = useContext(MetaContext);
  if (!ctx) throw new Error('useMeta must be used inside MetaProvider');
  return ctx;
}
