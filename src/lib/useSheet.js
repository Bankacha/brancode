import { useLocation, useNavigate } from "react-router";

// The open bottom sheet lives in the router's history state, so the system
// back button closes it. Opening pushes an entry on top of the screen;
// switching from one sheet to another replaces it, so back never steps
// through sheets the user already left.
export const useSheet = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const name = location.state?.sheet ?? null;

  const open = (next) =>
    navigate(location.pathname + location.search, { state: { sheet: next }, replace: name !== null });

  const close = () => {
    if (name !== null) navigate(-1);
  };

  return { name, open, close };
};
