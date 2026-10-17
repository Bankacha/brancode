// The manual-entry keypad: digits only (barcodes in the shop's list run from
// 1 to 15 digits, leading zeros included), capped at 20.
export const MAX_DIGITS = 20;

export const typeDigit = (code, key) => (/^[0-9]$/.test(key) && code.length < MAX_DIGITS ? code + key : code);

export const eraseDigit = (code) => code.slice(0, -1);
