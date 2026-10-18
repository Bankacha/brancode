// Closes a full-screen route (camera, manual entry). Pushing "/" would leave
// the screen behind it in history, so system back would reopen it; going
// back pops it instead. React Router marks the first page loaded (a deep
// link or refresh) with key "default" — there is no in-app page behind it.
// `home` is the screen these routes belong to: "/" for price tags, the list
// for a Popis or Trebovanje.
export const leaveScreen = (navigate, location, home = "/") => {
  if (location.key === "default") navigate(home, { replace: true });
  else navigate(-1);
};

// A full-screen route (camera, manual entry) opened as the first page — a
// deep link, or the app relaunched there — gets home put under it, so back
// and "finish" always land on home instead of leaving the app or the screen
// staying in history.
export const putHomeBehind = (navigate, location, home = "/") => {
  if (location.key !== "default") return;
  navigate(home, { replace: true });
  navigate(location.pathname, { state: location.state });
};

// Saving from the sheet over a full-screen route and leaving both: two
// entries back while the sheet is still open, one if back already closed it.
export const finishScreen = (navigate, sheetOpen) => navigate(sheetOpen ? -2 : -1);
