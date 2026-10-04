/*
 * Loads data through the REST client and exposes { data, loading, error, reload }.
 * `loader(signal)` must return a promise; it is re-run whenever a value in `deps` changes or
 * reload() is called. Previous data stays visible while a reload is in flight.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../utils/format.js';

export function useApi(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    loaderRef.current(controller.signal)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setState({ data: null, loading: false, error: errorMessage(error) });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
