// Serbian noun/verb form for a count: 1 artikal, 2 artikla, 5 artikala,
// 21 artikal, 22 artikla, 11–14 artikala.
export const plural = (n, one, few, many) => {
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit === 1 && lastTwo !== 11) return one;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
};
