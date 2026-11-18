import { useCallback, useEffect, useRef, useState } from 'react';
import { onDataChange } from '../services/dataService';
import type { ChangeKind, PageResult } from '../services/dataService';

/** The value, but only after it has stopped changing for a moment (used for the search box). */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

interface Options {
  /** Reload when the app announces a change of any of these kinds. */
  kinds?: ChangeKind[];
  /** Reload this often while the tab is visible. */
  intervalMs?: number;
}

/**
 * One page of a server-side list. Changing any of `deps` (filters, search, sort) goes back to page 1;
 * the list also refreshes by itself so new records appear without reloading.
 */
export function usePagedList<T>(
  fetchPage: (page: number) => Promise<PageResult<T>>,
  deps: unknown[],
  options: Options = {},
) {
  const { kinds = [], intervalMs = 30000 } = options;
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageResult<T>>({ items: [], total: 0, lastPage: 1 });
  const [loading, setLoading] = useState(true);

  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const requestId = useRef(0);
  const filterKey = JSON.stringify(deps);
  const lastFilterKey = useRef(filterKey);

  const load = useCallback(async (targetPage: number, showSpinner: boolean) => {
    const id = ++requestId.current;
    if (showSpinner) setLoading(true);
    try {
      const next = await fetchRef.current(targetPage);
      if (id !== requestId.current) return;
      setResult(next);
      if (targetPage > next.lastPage) setPage(next.lastPage);
    } catch {
      if (id === requestId.current) setResult((prev) => ({ ...prev, items: [], total: 0 }));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (lastFilterKey.current !== filterKey) {
      lastFilterKey.current = filterKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    void load(page, true);
  }, [filterKey, page, load]);

  const kindsKey = kinds.join(',');
  useEffect(() => {
    const quietReload = () => void load(page, false);
    const stopListening = onDataChange((kind) => {
      if (kindsKey.split(',').includes(kind)) quietReload();
    });
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') quietReload();
    }, intervalMs);
    return () => {
      stopListening();
      window.clearInterval(timer);
    };
  }, [kindsKey, intervalMs, load, page]);

  return {
    items: result.items,
    total: result.total,
    counts: result.counts,
    page,
    setPage,
    lastPage: result.lastPage,
    loading,
    reload: () => load(page, false),
  };
}
