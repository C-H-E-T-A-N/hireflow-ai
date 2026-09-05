"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, api } from "@/lib/api";

interface UseApiOptions {
  /** Poll interval in milliseconds. Omit or set 0 to fetch once. */
  refreshInterval?: number;
  /** Skip fetching entirely (e.g. while a required id is unknown). */
  enabled?: boolean;
}

interface UseApiResult<T> {
  data: T | undefined;
  error: ApiError | undefined;
  isLoading: boolean;
  /** True while a background refresh is in flight over existing data. */
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  mutate: (updater: (current: T | undefined) => T | undefined) => void;
}

/**
 * Small fetch-with-polling hook.
 *
 * Deliberately dependency-free: the app's needs are a load state, an error
 * state, and optional polling for live calls, which is not worth a data
 * library. Polling pauses while the tab is hidden.
 *
 * `isLoading` is derived rather than stored, so there is only one source of
 * truth and no state to synchronise when the path changes. Once data exists, a
 * changed path revalidates in the background instead of flashing a skeleton.
 */
export function useApi<T>(path: string | null, options: UseApiOptions = {}): UseApiResult<T> {
  const { refreshInterval = 0, enabled = true } = options;

  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeRef = useRef(true);

  const load = useCallback(
    async (background: boolean) => {
      if (!path || !enabled) return;
      if (background) setIsRefreshing(true);

      try {
        const result = await api.get<T>(path);
        if (!activeRef.current) return;
        setData(result);
        setError(undefined);
      } catch (caught) {
        if (!activeRef.current) return;
        setError(
          caught instanceof ApiError
            ? caught
            : new ApiError("Something went wrong.", 0, "unknown"),
        );
      } finally {
        if (activeRef.current && background) setIsRefreshing(false);
      }
    },
    [path, enabled],
  );

  useEffect(() => {
    activeRef.current = true;
    // `load` only calls setState after awaiting the request, i.e. from an async
    // callback rather than synchronously during the effect. The lint rule
    // cannot see across the await, so it is suppressed here deliberately.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);
    return () => {
      activeRef.current = false;
    };
  }, [load]);

  useEffect(() => {
    if (!refreshInterval || !path || !enabled) return;
    const timer = window.setInterval(() => {
      // No point polling a tab nobody is looking at.
      if (document.visibilityState === "visible") void load(true);
    }, refreshInterval);
    return () => window.clearInterval(timer);
  }, [refreshInterval, path, enabled, load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  const mutate = useCallback((updater: (current: T | undefined) => T | undefined) => {
    setData((current) => updater(current));
  }, []);

  const isLoading = Boolean(path) && enabled && data === undefined && error === undefined;

  return { data, error, isLoading, isRefreshing, refresh, mutate };
}
