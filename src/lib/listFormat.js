// Names, dates and quantities for the Popis and Trebovanje lists. Dates are
// ISO "yyyy-mm-dd" strings (Postgres `date`), shown as dd.mm.yyyy.

export const formatDate = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

const isoOf = (date) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

// Local time: late in the evening it's still today in the shop.
export const todayIso = (now = new Date()) => isoOf(now);
export const monthStartIso = (now = new Date()) => isoOf(new Date(now.getFullYear(), now.getMonth(), 1));

const withText = (title, rest, separator) => {
  const text = (title ?? "").trim();
  return text ? `${text}${separator}${rest}` : rest;
};

// "Magacin · 01.10.2026 – 18.10.2026", or just the period.
export const inventoryTitle = ({ title, dateFrom, dateTo }) => withText(title, `${formatDate(dateFrom)} – ${formatDate(dateTo)}`, " · ");

// A typed quantity: digits with an optional comma or dot and up to three
// decimals (goods sold by weight). Zero only where it means "none on the shelf".
export const parseQuantity = (text, { allowZero = false } = {}) => {
  const trimmed = (text ?? "").trim();
  if (!/^\d+([.,]\d{1,3})?$/.test(trimmed)) return null;
  const value = Number(trimmed.replace(",", "."));
  return value > 0 || (allowZero && value === 0) ? value : null;
};

export const formatQuantity = (n) => n.toLocaleString("sr-RS", { maximumFractionDigits: 3 });
