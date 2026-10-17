import { useState } from "react";

// Temporary: lets the shop compare the built-in reader with zxing on its
// Android phones; removed once one is chosen. "auto" = built-in when available.
const STORAGE_KEY = "scanner-reader";
const SETTINGS = ["auto", "native", "zxing"];

const read = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return SETTINGS.includes(raw) ? raw : "auto";
  } catch (e) {
    return "auto";
  }
};

export const useScannerReader = () => {
  const [setting, setSetting] = useState(read);
  const persist = (next) => {
    setSetting(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      console.error("save scanner reader failed", e);
    }
  };
  return [setting, persist];
};
