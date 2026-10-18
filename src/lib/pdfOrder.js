import { useState } from "react";

// How the items of a Popis / Trebovanje are ordered in its PDF, chosen per
// list kind in Podešavanja and remembered on this phone. By name unless
// someone picks "Redom dodavanja".
const STORAGE_KEY = "pdf-order";
export const PDF_ORDERS = [
  { key: "name", label: "Po nazivu" },
  { key: "added", label: "Redom dodavanja" },
];
const DEFAULTS = { popis: "name", trebovanje: "name" };
const valid = (value) => PDF_ORDERS.some((o) => o.key === value);

export const parseStoredPdfOrder = (raw) => {
  let stored = {};
  try {
    stored = JSON.parse(raw ?? "{}") ?? {};
  } catch (e) {
    stored = {};
  }
  return Object.fromEntries(Object.entries(DEFAULTS).map(([section, fallback]) => [section, valid(stored[section]) ? stored[section] : fallback]));
};

const readAll = () => {
  try {
    return parseStoredPdfOrder(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    return { ...DEFAULTS };
  }
};

// Read when exporting, so a choice made on another screen counts right away.
export const readPdfOrder = (section) => readAll()[section];

export const usePdfOrder = () => {
  const [orders, setOrders] = useState(readAll);
  const setOrder = (section, order) => {
    const next = { ...orders, [section]: order };
    setOrders(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("save pdf order failed", e);
    }
  };
  return [orders, setOrder];
};

// Serbian Latin order (č, ć after c; dž, đ after d; lj after l), "Mleko 2"
// before "Mleko 10".
const byName = new Intl.Collator("sr-Latn", { sensitivity: "base", numeric: true });

export const orderForPdf = (items, order) =>
  order === "added"
    ? [...items].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
    : [...items].sort((a, b) => byName.compare(a.name, b.name));
