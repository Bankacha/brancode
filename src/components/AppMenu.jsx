import { Link, useLocation, useNavigate } from "react-router";
import { LogOut, Menu, Settings, Tag } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useSession } from "../auth/session.jsx";
import { useToast } from "./Toast.jsx";
import { useSheet } from "../lib/useSheet.js";
import BottomSheet from "./BottomSheet.jsx";
import IconButton from "./IconButton.jsx";
import SettingsSheet from "../sheets/SettingsSheet.jsx";

// The app's sections; each new feature adds its entry here.
export const SECTIONS = [{ path: "/", label: "Cenovnici", icon: Tag }];

function MenuRow({ icon: Icon, children, active, ...props }) {
  const Tag = props.to ? Link : "button";
  return (
    <Tag
      {...(Tag === "button" ? { type: "button" } : {})}
      {...props}
      className={`flex h-14 w-full items-center gap-3.5 rounded-field px-4 text-left text-[17px] font-semibold text-ink transition-transform duration-100 active:scale-[.98] ${
        active ? "bg-surface-muted" : ""
      }`}
    >
      <Icon size={22} className={active ? "text-accent" : "text-ink-2"} />
      {children}
    </Tag>
  );
}

// Menu button for the header plus the menu and settings sheets (opened from
// the bottom, within thumb reach). Sheet state lives in history: back closes.
export default function AppMenu() {
  const session = useSession();
  const sheet = useSheet();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const go = (e, path) => {
    e.preventDefault();
    if (path === location.pathname) sheet.close();
    else navigate(path, { replace: true }); // the menu's history entry becomes the section
  };

  // Offline, Supabase keeps the session and only returns an error.
  const signOut = async () => {
    sheet.close();
    const { error } = await supabase.auth.signOut();
    if (error) toast.show({ kind: "error", text: "Odjava nije uspela. Proveri internet pa probaj ponovo." });
  };

  return (
    <>
      <IconButton label="Meni" icon={Menu} onClick={() => sheet.open("menu")} />

      <BottomSheet open={sheet.name === "menu"} onClose={sheet.close}>
        <nav className="flex flex-col gap-1">
          {SECTIONS.map(({ path, label, icon }) => {
            const active = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
            return (
              <MenuRow key={path} to={path} icon={icon} active={active} aria-current={active ? "page" : undefined} onClick={(e) => go(e, path)}>
                {label}
              </MenuRow>
            );
          })}
        </nav>
        <div className="h-px bg-border-soft" />
        <MenuRow icon={Settings} onClick={() => sheet.open("settings")}>
          Podešavanja
        </MenuRow>
        <MenuRow icon={LogOut} onClick={signOut}>
          Odjavi se
        </MenuRow>
        {session?.user?.email && <p className="px-4 font-mono text-xs text-ink-3">{session.user.email}</p>}
      </BottomSheet>

      <SettingsSheet open={sheet.name === "settings"} onClose={sheet.close} />
    </>
  );
}
