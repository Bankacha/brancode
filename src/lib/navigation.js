// Closes a full-screen route (camera, manual entry). Pushing "/" would leave
// the screen behind it in history, so system back would reopen it; going
// back pops it instead. React Router marks the first page loaded (a deep
// link or refresh) with key "default" — there is no in-app page behind it.
export const leaveScreen = (navigate, location) => {
  if (location.key === "default") navigate("/", { replace: true });
  else navigate(-1);
};
