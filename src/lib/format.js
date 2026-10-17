// Prices are shown and printed the Serbian way: "1.249,99".
export const formatPrice = (price) =>
  price.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
