import { formatPrice } from "./format.js";
import { formatDate, formatQuantity, itemCount, todayIso } from "./listFormat.js";

// PDF exports of the lists (pdfmake). The document definitions are plain
// data, tested on their own; pdfmake and its Roboto font (č ć š ž đ) load
// only when a PDF is actually made.

const header = (labels) => labels.map(([text, alignment = "left"]) => ({ text, style: "th", alignment }));
const right = (text) => ({ text, alignment: "right" });

const tableDocument = ({ title, lines, widths, head, rows }) => ({
  pageSize: "A4",
  pageOrientation: "portrait",
  pageMargins: [36, 40, 36, 48],
  info: { title },
  defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.15 },
  styles: {
    title: { fontSize: 18, bold: true, margin: [0, 0, 0, 4] },
    meta: { fontSize: 10, color: "#555555" },
    th: { bold: true, fontSize: 9, color: "#333333", fillColor: "#eeeeee" },
  },
  content: [
    { text: title, style: "title" },
    ...lines.map((text) => ({ text, style: "meta" })),
    {
      margin: [0, 14, 0, 0],
      table: { headerRows: 1, dontBreakRows: true, widths, body: [header(head), ...rows] },
      layout: "lightHorizontalLines",
    },
  ],
  footer: (currentPage, pageCount) => ({ text: `Strana ${currentPage} od ${pageCount}`, alignment: "center", fontSize: 9, color: "#555555", margin: [0, 16, 0, 0] }),
});

export const inventoryPdfDefinition = (inventory, items, now = new Date()) =>
  tableDocument({
    title: inventory.title.trim() ? `Popis · ${inventory.title.trim()}` : "Popis",
    lines: [`Period: ${formatDate(inventory.dateFrom)} – ${formatDate(inventory.dateTo)}`, `Izrađeno ${formatDate(todayIso(now))} · ${itemCount(items.length)}`],
    widths: [22, "*", 88, 60, 52],
    head: [["#"], ["Naziv"], ["Barkod"], ["Cena", "right"], ["Količina", "right"]],
    rows: items.map((item, i) => [String(i + 1), item.name, item.barcode, right(formatPrice(item.price)), right(formatQuantity(item.quantity))]),
  });

export const inventoryPdfFilename = (inventory) => `popis-${inventory.dateFrom}_${inventory.dateTo}.pdf`;

// An empty square to tick by hand after printing.
const tickBox = { canvas: [{ type: "rect", x: 2, y: 1, w: 9, h: 9, lineWidth: 0.8, lineColor: "#333333" }] };
const orEmpty = (value, format) => (value === null || value === undefined ? "" : format(value));

export const requisitionPdfDefinition = (requisition, items, now = new Date()) =>
  tableDocument({
    title: requisition.title.trim() ? `Trebovanje · ${requisition.title.trim()}` : "Trebovanje",
    lines: [`Datum: ${formatDate(requisition.date)}`, `Izrađeno ${formatDate(todayIso(now))} · ${itemCount(items.length)}`],
    widths: ["*", 88, 60, 52, 16],
    head: [["Naziv"], ["Barkod"], ["Cena", "right"], ["Količina", "right"], [""]],
    rows: items.map((item) => [
      item.name,
      item.barcode ?? "",
      right(orEmpty(item.price, formatPrice)),
      right(orEmpty(item.quantity, formatQuantity)),
      tickBox,
    ]),
  });

export const requisitionPdfFilename = (requisition) => `trebovanje-${requisition.date}.pdf`;

// Browser only.
export const buildPdfBlob = async (definition) => {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")]);
  pdfMake.addVirtualFileSystem(vfs);
  return pdfMake.createPdf(definition).getBlob();
};
