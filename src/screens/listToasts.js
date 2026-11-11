import { Check, WifiOff } from "lucide-react";
import { formatQuantity } from "../lib/listFormat.js";

const quantity = (n) => (n === null || n === undefined ? undefined : formatQuantity(n));

// The status line after a list item was saved, the same from every screen.
// nameInProducts: a trebovanje's renamed article whose new name was to go
// into the database too ("saved" | "failed").
export const savedToast = ({ action, item, amount, nameInProducts }) => {
  if (action === "added-quantity")
    return { kind: "success", icon: Check, text: `Dodato još ${formatQuantity(amount)}: ${item.name}`, detail: `ukupno ${formatQuantity(item.quantity)}` };
  if (nameInProducts === "failed")
    return { kind: "error", icon: WifiOff, text: `Naziv nije upisan u bazu: ${item.name}`, detail: "Na trebovanju je sačuvan. Proveri internet pa izmeni ponovo." };
  const detail = [quantity(item.quantity), nameInProducts === "saved" && "naziv sačuvan i u bazi"].filter(Boolean).join(" · ") || undefined;
  return { kind: "success", icon: Check, text: `${action === "updated" ? "Izmenjeno" : "Dodato"}: ${item.name}`, detail };
};
