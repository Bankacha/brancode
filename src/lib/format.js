// Prices are shown and printed the Serbian way: "1.249,99".
export const formatPrice = (price) =>
  price.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// A typed price: one decimal comma or dot, no thousands grouping, above 0.
export const parsePrice = (text) => {
  const trimmed = text.trim();
  if (!trimmed || (trimmed.includes(",") && trimmed.includes("."))) return null;
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
};

export const toPriceInput = (price) => String(price).replace(".", ",");
