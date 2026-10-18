import { useCallback, useEffect, useRef, useState } from "react";

// Loads data for a screen when it opens (and again on `reload`), keeping the
// last good data while a reload runs. Lists are shared between phones, so
// screens reload after every change instead of patching local copies.
export const useLoad = (load, deps) => {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const request = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    const id = ++request.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await loadRef.current();
      if (id === request.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (id === request.current) setState((s) => ({ ...s, error, loading: false }));
      return undefined;
    }
  }, []);

  useEffect(() => {
    reload();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, reload };
};
