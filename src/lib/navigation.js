// Closes a full-screen route (camera, manual entry). Pushing "/" would leave
// the screen behind it in history, so system back would reopen it; going
// back pops it instead. React Router marks the first page loaded (a deep
// link or refresh) with key "default" — there is no in-app page behind it.
export const leaveScreen = (navigate, location) => {
  if (location.key === "default") navigate("/", { replace: true });
  else navigate(-1);
};

// Opens a home sheet (the editor) in place of a full-screen route. From
// inside the app the camera/manual-entry entry becomes "home + sheet", so
// back closes the sheet onto the home already behind it. On a deep link
// there is no home behind, so one is put under the sheet first.
export const openSheetOverHome = (navigate, location, sheet) => {
  if (location.key === "default") {
    navigate("/", { replace: true });
    navigate("/", { state: { sheet } });
  } else {
    navigate("/", { replace: true, state: { sheet } });
  }
};
