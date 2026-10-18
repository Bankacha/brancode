import { createContext, useContext } from "react";

// The signed-in Supabase session, for any screen that needs the user (menu).
const SessionContext = createContext(null);

export const SessionProvider = ({ value, children }) => <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;

export const useSession = () => useContext(SessionContext);
