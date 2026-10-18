import { Check } from "lucide-react";
import { formatQuantity } from "../lib/listFormat.js";

// The status line after a popis item was saved, the same from every screen.
export const savedToast = ({ action, item, amount }) => {
  if (action === "added-quantity")
    return { kind: "success", icon: Check, text: `Dodato još ${formatQuantity(amount)}: ${item.name}`, detail: `ukupno ${formatQuantity(item.quantity)}` };
  if (action === "updated") return { kind: "success", icon: Check, text: `Izmenjeno: ${item.name}`, detail: formatQuantity(item.quantity) };
  return { kind: "success", icon: Check, text: `Dodato: ${item.name}`, detail: formatQuantity(item.quantity) };
};
