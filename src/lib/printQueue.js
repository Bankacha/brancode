import { useState } from "react";

// The print queue is per device: kept in localStorage, never in Supabase.
// Items: { id, barcode, name, price, notInDb?, copies? }
const STORAGE_KEY = "print-queue";

// How many times one tag prints. Left out means 1; anything stored that
// isn't a whole number counts as 1, and more than MAX_COPIES as MAX_COPIES.
export const MAX_COPIES = 20;

export const copiesOf = (item) =>
  Number.isInteger(item.copies) ? Math.min(Math.max(item.copies, 1), MAX_COPIES) : 1;

export const withCopies = (item, n) => {
  const next = { ...item, copies: copiesOf({ copies: n }) };
  if (next.copies === 1) delete next.copies;
  return next;
};

export const tagCount = (queue) => queue.reduce((sum, item) => sum + copiesOf(item), 0);

// Each item repeated one after another; the repeats get their own ids
// because the print preview keys tags by id.
export const expandCopies = (queue) =>
  queue.flatMap((item) => Array.from({ length: copiesOf(item) }, (_, k) => (k === 0 ? item : { ...item, id: `${item.id}#${k + 1}` })));

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
