// GTIN check digit (EAN-8, UPC-12, EAN-13, GTIN-14 alike): weights 3,1,3,…
// from the right of the data digits.
const checkDigit = (data) => {
  const sum = data
    .split("")
    .reverse()
    .reduce((total, d, i) => total + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
};

export const gtinCheckDigitOk = (code) => /^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code) && checkDigit(code.slice(0, -1)) === code.at(-1);
export const eanCheckDigitOk = gtinCheckDigitOk;

// The POS export drops the check digit of every GTIN it stores: an EAN-8 is
// kept as 7 digits, an EAN-13 as 12, and so on.
export const withCheckDigit = (data) => data + checkDigit(data);
export const withoutCheckDigit = (code) => (gtinCheckDigitOk(code) ? code.slice(0, -1) : null);

// Codes that mean the same article: the code itself, the code without its
// check digit (a scanned code, stored by the POS export), and for a code one
// digit short of a GTIN, the code with its check digit added (typed from the
// database). Lists match on these, so either form finds the other.
export const sameArticleCodes = (code) => {
  const codes = [code, withoutCheckDigit(code)];
  if (/^(\d{7}|\d{11}|\d{12})$/.test(code)) codes.splice(1, 0, withCheckDigit(code));
  return [...new Set(codes.filter(Boolean))];
};
