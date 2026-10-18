import { Check } from "lucide-react";
import { formatQuantity } from "../lib/listFormat.js";

const quantity = (n) => (n === null || n === undefined ? undefined : formatQuantity(n));

// The status line after a list item was saved, the same from every screen.
export const savedToast = ({ action, item, amount }) => {
  if (action === "added-quantity")
    return { kind: "success", icon: Check, text: `Dodato još ${formatQuantity(amount)}: ${item.name}`, detail: `ukupno ${formatQuantity(item.quantity)}` };
  if (action === "updated") return { kind: "success", icon: Check, text: `Izmenjeno: ${item.name}`, detail: quantity(item.quantity) };
  return { kind: "success", icon: Check, text: `Dodato: ${item.name}`, detail: quantity(item.quantity) };
};
