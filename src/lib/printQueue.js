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

// Same barcode → replaced where it is (keeping its id, so the row stays put);
// a new barcode is appended. The new item carries no `notInDb` unless given.
export const upsertQueueItem = (queue, item) => {
  const index = queue.findIndex((q) => q.barcode === item.barcode);
  if (index === -1) return [...queue, item];
  return queue.map((q, i) => (i === index ? { ...item, id: q.id } : q));
};

export const withoutItem = (queue, id) => {
  const index = queue.findIndex((q) => q.id === id);
  if (index === -1) return { next: queue, removed: null };
  return { next: queue.filter((q) => q.id !== id), removed: { item: queue[index], index } };
};

// Undo for withoutItem. Skipped if the article was added back meanwhile.
export const withItemRestored = (queue, { item, index }) => {
  if (queue.some((q) => q.barcode === item.barcode)) return queue;
  const at = Math.min(index, queue.length);
  return [...queue.slice(0, at), item, ...queue.slice(at)];
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
