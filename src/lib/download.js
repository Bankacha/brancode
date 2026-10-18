import { buildWorkbookBuffer, sheetFilename } from "./priceTags.js";

// Browser only: saves a file to the device.
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// Browser only: saves the price-tag sheet for `format` to the device.
export const downloadWorkbook = async (queue, format) => {
  const buffer = await buildWorkbookBuffer(queue, format);
  downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), sheetFilename(format));
};
