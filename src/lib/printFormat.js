import { useState } from "react";
import { PRICE_TAG_STYLES } from "./priceTags.js";

// The chosen tag format is remembered per device; shelf tags by default.
const STORAGE_KEY = "print-format";

export const parseStoredFormat = (raw) => (Object.hasOwn(PRICE_TAG_STYLES, raw ?? "") ? raw : "shelf");

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
