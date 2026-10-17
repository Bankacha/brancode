import { useRef } from "react";
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

  return { name, open, close };
};
