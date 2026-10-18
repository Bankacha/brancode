// Round icon-only button for headers; `label` is what screen readers announce.
export default function IconButton({ label, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full bg-surface-muted text-ink transition-transform duration-100 active:scale-[.97]"
    >
      <Icon size={20} />
    </button>
  );
}
