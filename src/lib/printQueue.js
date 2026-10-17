import { useState } from "react";

// The print queue is per device: kept in localStorage, never in Supabase.
// Items: { id, barcode, name, price, notInDb? }
const STORAGE_KEY = "print-queue";

export const parseStoredQueue = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const readStoredQueue = () => {
  try {
    return parseStoredQueue(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    return [];
  }
};

export const usePrintQueue = () => {
  const [queue, setQueue] = useState(readStoredQueue);
  const persistQueue = (next) => {
    setQueue(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("save queue failed", e);
    }
  };
  return [queue, persistQueue];
};
