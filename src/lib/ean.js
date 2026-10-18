// EAN-13 / EAN-8 check digit: weights 3,1,3,… from the right of the data digits.
const checkDigit = (data) => {
  const sum = data
    .split("")
    .reverse()
    .reduce((total, d, i) => total + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
};

export const eanCheckDigitOk = (code) => /^\d{8}$|^\d{13}$/.test(code) && checkDigit(code.slice(0, -1)) === code.at(-1);

// The POS export dropped the check digit from about half the EAN-13 codes.
export const withCheckDigit = (code12) => code12 + checkDigit(code12);

// Codes that mean the same article: a full EAN-13 and its 12-digit prefix.
// Lists match on these so a scanned 13-digit code finds a typed 12-digit one
// and the other way round.
export const sameArticleCodes = (code) => {
  if (/^\d{13}$/.test(code) && eanCheckDigitOk(code)) return [code, code.slice(0, 12)];
  if (/^\d{12}$/.test(code)) return [code, withCheckDigit(code)];
  return [code];
};
