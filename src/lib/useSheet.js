import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";

// The open bottom sheet lives in the router's history state, so the system
// back button closes it. Opening pushes an entry on top of the screen;
// switching from one sheet to another replaces it, so back never steps
// through sheets the user already left.
//
// open/close read the current sheet from a ref, not from their render's
// closure: they are often called after an await (a save, a PDF read) when
// the user may already have closed or switched the sheet. close() also
// latches, so two calls before the page updates pop only one entry.
export const useSheet = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const name = location.state?.sheet ?? null;
  const current = useRef(name);
  const lastLocation = useRef(location);
  if (lastLocation.current !== location) {
    lastLocation.current = location;
    current.current = name;
  }

  const open = (next) => {
    const replace = current.current !== null;
    current.current = next;
    navigate(location.pathname + location.search, { state: { sheet: next }, replace });
  };

  const close = () => {
    if (current.current === null) return;
    current.current = null;
    navigate(-1);
  };

  // Whether a sheet is open right now, for decisions made after an await.
  const isOpen = () => current.current !== null;

  return { name, open, close, isOpen };
};

// A small dialog over an open sheet (e.g. "Broj kopija" over the price
// sheet). Unlike sheets it pushes its own history entry, keeping the
// sheet's, so system back closes only the dialog. close() latches like
// useSheet's.
export const useDialog = (name) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isOpen = location.state?.dialog === name;
  const current = useRef(isOpen);
  const lastLocation = useRef(location);
  if (lastLocation.current !== location) {
    lastLocation.current = location;
    current.current = isOpen;
  }

  const open = () => {
    if (current.current) return;
    current.current = true;
    navigate(location.pathname + location.search, { state: { ...location.state, dialog: name } });
  };

  const close = () => {
    if (!current.current) return;
    current.current = false;
    navigate(-1);
  };

  return { isOpen, open, close };
};

// After a reload the history can still say a sheet is open while its data is
// gone (`isStale`): drop that entry instead of showing an empty sheet — and,
// when the copies window was open over it, both entries, so back doesn't land
// on the empty sheet (unless this is the first entry, where nothing lies
// under it). Once, on the first render (the ref keeps StrictMode's second
// effect run from going back twice).
export const useDropStaleSheet = (isStale) => {
  const location = useLocation();
  const navigate = useNavigate();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !isStale) return;
    done.current = true;
    if (location.state?.dialog && location.key !== "default") navigate(-2);
    else navigate(".", { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
};
