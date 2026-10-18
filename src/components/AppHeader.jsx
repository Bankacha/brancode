import AppMenu from "./AppMenu.jsx";

// Top of every section screen: title left, actions and the menu button right.
export default function AppHeader({ title, actions }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">{title}</div>
      <div className="flex shrink-0 gap-2">
        {actions}
        <AppMenu />
      </div>
    </header>
  );
}
