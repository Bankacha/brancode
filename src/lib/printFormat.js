import { useState } from "react";

// The chosen tag format is remembered per device; shelf tags by default.
// "mix" gives every tag its own format (shelf or fridge, see printQueue.js).
const STORAGE_KEY = "print-format";

export const PRINT_FORMATS = ["shelf", "fridge", "fruit", "mix"];

export const parseStoredFormat = (raw) => (PRINT_FORMATS.includes(raw) ? raw : "shelf");

// The format a single tag is drawn in (the price sheet's preview).
export const tagFormatOf = (format, mixFormat) => (format === "mix" ? mixFormat ?? "shelf" : format);

const readStoredFormat = () => {
  try {
    return parseStoredFormat(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    return "shelf";
  }
};

export const usePrintFormat = () => {
  const [format, setFormat] = useState(readStoredFormat);
  const persistFormat = (next) => {
    setFormat(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      console.error("save print format failed", e);
    }
  };
  return [format, persistFormat];
};
