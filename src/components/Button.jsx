// Pill buttons from the handoff. lg = primary 62px, md = secondary 52px.
const variants = {
  accent: "bg-accent text-white",
  dark: "bg-ink text-bg",
  outline: "border-[1.5px] border-border bg-surface text-ink",
  muted: "bg-surface-muted text-ink",
  text: "bg-transparent text-ink-2",
};

const sizes = {
  lg: "h-[62px] px-6 text-[17px] font-bold",
  md: "h-[52px] px-5 text-[15px] font-semibold",
};

export default function Button({ variant = "accent", size = "lg", icon: Icon, iconRight: IconRight, className = "", children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex select-none items-center justify-center gap-2 rounded-full transition-transform duration-100 active:scale-[.97] disabled:opacity-50 disabled:active:scale-100 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={20} />}
      {children}
      {IconRight && <IconRight size={20} />}
    </button>
  );
}
