import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { WifiOff } from "lucide-react";
import { finishScreen, putHomeBehind } from "../lib/navigation.js";
import { useInventoryItemFlow } from "../lib/useInventoryItemFlow.js";
import { useSheet } from "../lib/useSheet.js";
import { useToast } from "../components/Toast.jsx";
import { savedToast } from "./inventoryToasts.js";

// Shared by the popis camera and keypad screens: a code starts the item flow
// in the "item" sheet; saving either continues with the next code or goes
// back to the popis. The popis is "home" for both screens.
export const useInventoryEntry = (id, { onNext } = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const sheet = useSheet();
  const toast = useToast();
  const flow = useInventoryItemFlow(id);
  const home = `/popis/${id}`;

  // Opened as the first page: put the popis behind (once — StrictMode runs effects twice).
  const homeBehind = useRef(false);
  useEffect(() => {
    if (homeBehind.current) return;
    homeBehind.current = true;
    putHomeBehind(navigate, location, home);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A refreshed page has no flow in progress: drop a stale "item" entry.
  useEffect(() => {
    if (sheet.name === "item" && flow.state.kind === "idle") navigate(".", { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = async (code) => {
    sheet.open("item");
    const result = await flow.start(code);
    if (result.ok) return;
    sheet.close();
    toast.show({ kind: "error", icon: WifiOff, text: "Nema veze. Artikal nije proveren.", action: { label: "Ponovi", run: () => beginRef.current(code) } });
  };
  const beginRef = useRef(begin);
  beginRef.current = begin;

  const submit = async (then) => {
    const result = await flow.save();
    if (result.ok) {
      toast.show(savedToast(result));
      if (then === "next") {
        sheet.close();
        onNext?.();
      } else {
        finishScreen(navigate, sheet.isOpen());
      }
    } else if (result.reason === "network") {
      toast.show({ kind: "error", icon: WifiOff, text: "Nema veze. Nije sačuvano.", action: { label: "Ponovi", run: () => submitRef.current(then) } });
    } else if (result.reason === "gone") {
      toast.show({ kind: "info", text: "Stavka je u međuvremenu obrisana." });
      sheet.close();
    } else if (result.reason === "list-gone") {
      toast.show({ kind: "info", text: "Popis više ne postoji. Obrisan je na drugom telefonu." });
      navigate("/popis", { replace: true });
    }
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  const close = () => {
    sheet.close();
    flow.cancel();
  };

  return { flow, sheet, home, begin, submit, close, open: sheet.name === "item" && flow.state.kind !== "idle" };
};
