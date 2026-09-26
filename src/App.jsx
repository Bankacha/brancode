import React, { useState, useRef, useEffect, useCallback } from "react";
import { Scan, X, Plus, Download, Check, Camera, Keyboard, AlertCircle, Mail } from "lucide-react";
import ExcelJS from "exceljs";
import JsBarcode from "jsbarcode";
import { supabase } from "./supabaseClient";

export const FONT_SANS = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const FONT_MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export const PAPER = "#FAF7F0";
export const INK = "#1F1B16";
export const RED = "#C1443C";
export const GREEN = "#5B7A6A";
export const MUTE = "#8A8073";
export const BORDER = "#DED7C6";
export const CARD = "#FFFFFF";

// Fridge price holders cover the top and bottom of the printed strip, so only a
// middle band is visible — the fridge preset adds blank space above the name
// (pushed out of view) and pulls both lines snug against the divider between
// them (the part that stays visible), instead of centering them.
const MM_TO_PT = 2.834645669;
const FRIDGE_TOP_BUFFER_MM = 1; // blank space above the name, hidden behind the holder's top edge
const FRIDGE_BOTTOM_BUFFER_MM = 5; // blank space below the price digit, hidden behind the holder's bottom edge
// Always give the fridge name row the extra headroom a wrapped 2-line name
// would need — simpler and more consistent than only adding it for long names.
const FRIDGE_EXTRA_TOP_MM = 4;
const FRIDGE_PRICE_FONT_SIZE = 42; // always the "over 1000 din" size, for a consistent look

// Fruit tags are much bigger (~6cm total) and print 2 per row instead of 3,
// with a scannable barcode image in a 3rd row below the price.
const FRUIT_NAME_HEIGHT_MM = 18;
const FRUIT_PRICE_HEIGHT_MM = 29;
const FRUIT_BARCODE_HEIGHT_MM = 13;
const FRUIT_NAME_FONT_SIZE = 22;
const FRUIT_PRICE_FONT_SIZE = () => 62; // always the "over 1000 din" size, for a consistent look
const FRUIT_BARCODE_WIDTH_FRACTION = 0.83; // fraction of the column width the barcode image uses, centered

const PRICE_TAG_STYLES = {
  shelf: {
    label: "Cene za rafove",
    columns: 3,
    columnWidth: 26.75,
    nameRowHeight: 28.5,
    priceRowHeight: 77.25,
    nameFontSize: 12,
    nameAlignment: { horizontal: "center", vertical: "middle", wrapText: true },
    priceAlignment: { horizontal: "center", vertical: "middle", shrinkToFit: true },
    priceFontSize: (priceText) => {
      if (priceText.length <= 6) return 50; // e.g. "219,00"
      if (priceText.length <= 8) return 42; // e.g. "1.249,99"
      return 34; // e.g. "12.499,99" or longer
    },
    hasBarcode: false,
  },
  fridge: {
    label: "Cene za frižider",
    columns: 3,
    columnWidth: 26.75,
    nameRowHeight: 28.5 + (FRIDGE_TOP_BUFFER_MM + FRIDGE_EXTRA_TOP_MM) * MM_TO_PT,
    priceRowHeight: 77.25 + FRIDGE_BOTTOM_BUFFER_MM * MM_TO_PT - FRIDGE_EXTRA_TOP_MM * MM_TO_PT,
    nameFontSize: 12,
    nameAlignment: { horizontal: "center", vertical: "bottom", wrapText: true },
    priceAlignment: { horizontal: "center", vertical: "top", shrinkToFit: true },
    priceFontSize: () => FRIDGE_PRICE_FONT_SIZE,
    hasBarcode: false,
  },
  fruit: {
    label: "Cene za voće",
    columns: 2,
    columnWidth: 40,
    nameRowHeight: FRUIT_NAME_HEIGHT_MM * MM_TO_PT,
    priceRowHeight: FRUIT_PRICE_HEIGHT_MM * MM_TO_PT,
    barcodeRowHeight: FRUIT_BARCODE_HEIGHT_MM * MM_TO_PT,
    nameFontSize: FRUIT_NAME_FONT_SIZE,
    nameAlignment: { horizontal: "center", vertical: "middle", wrapText: true },
    priceAlignment: { horizontal: "center", vertical: "middle", shrinkToFit: true },
    priceFontSize: FRUIT_PRICE_FONT_SIZE,
    hasBarcode: true,
  },
};

export default function PriceScanner() {
  const [queue, setQueue] = useState([]); // [{barcode, name, price, id}]
  const [mode, setMode] = useState("idle"); // idle | scanning | editing | manualEntry
  const [scannedBarcode, setScannedBarcode] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [cameraError, setCameraError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [emailSent, setEmailSent] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // null | "download" | "email"

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectRef = useRef(null);

  // print queue is per-device, kept in localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("print-queue");
      if (raw) setQueue(JSON.parse(raw));
    } catch (e) {}
  }, []);

  const persistQueue = (next) => {
    setQueue(next);
    try {
      localStorage.setItem("print-queue", JSON.stringify(next));
    } catch (e) {
      console.error("save queue failed", e);
    }
  };

  const stopCamera = useCallback(() => {
    if (detectRef.current) {
      cancelAnimationFrame(detectRef.current);
      detectRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  // Some imported rows store EAN-13 barcodes without their trailing check
  // digit (only 12 digits), so a live 13-digit scan won't string-match them.
  // Fall back to the 12-digit prefix when the full barcode isn't found.
  const lookupProduct = async (barcode) => {
    let { data, error } = await supabase
      .from("products")
      .select("name, price")
      .eq("barcode", barcode)
      .maybeSingle();
    if (error) throw error;
    if (!data && /^\d{13}$/.test(barcode)) {
      ({ data, error } = await supabase
        .from("products")
        .select("name, price")
        .eq("barcode", barcode.slice(0, 12))
        .maybeSingle());
      if (error) throw error;
    }
    return data;
  };

  const openProduct = async (barcode) => {
    setScannedBarcode(barcode);
    setEditName("");
    setEditPrice("");
    setIsNewProduct(false);
    setSaveError(null);
    setMode("editing");
    setLookupLoading(true);
    try {
      const data = await lookupProduct(barcode);
      if (data) {
        setEditName(data.name || "");
        setEditPrice(data.price != null ? String(data.price) : "");
        setIsNewProduct(false);
      } else {
        setIsNewProduct(true);
      }
    } catch (e) {
      console.error("lookup failed", e);
      setSaveError("Ne mogu da se povežem sa bazom. Proveri internet konekciju.");
    }
    setLookupLoading(false);
  };

  const startScan = async () => {
    setCameraError(null);
    setMode("scanning");
    if (!("BarcodeDetector" in window)) {
      setCameraError("Camera barcode scanning isn't supported in this browser/preview. Use manual entry below, or open this app on a phone with Chrome for live scanning.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
      });
      const loop = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          detectRef.current = requestAnimationFrame(loop);
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            stopCamera();
            openProduct(codes[0].rawValue);
            return;
          }
        } catch (e) {}
        detectRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      setCameraError("Couldn't access the camera (permission denied or unavailable). Use manual entry instead.");
    }
  };

  const cancelScan = () => {
    stopCamera();
    setMode("idle");
  };

  const submitManualBarcode = () => {
    if (!manualBarcode.trim()) return;
    openProduct(manualBarcode.trim());
    setManualBarcode("");
  };

  const saveAndQueue = async () => {
    if (!editName.trim() || editPrice === "") return;
    const priceNum = parseFloat(editPrice.replace(",", "."));
    if (isNaN(priceNum)) return;

    setSaveError(null);
    try {
      const { error } = await supabase
        .from("products")
        .upsert({ barcode: scannedBarcode, name: editName.trim(), price: priceNum });
      if (error) throw error;
    } catch (e) {
      console.error("save to supabase failed", e);
      setSaveError("Čuvanje u bazi nije uspelo. Proveri internet konekciju i probaj ponovo.");
      return;
    }

    const withoutDuplicate = queue.filter((q) => q.barcode !== scannedBarcode);
    const nextQueue = [
      ...withoutDuplicate,
      { id: `${scannedBarcode}-${Date.now()}`, barcode: scannedBarcode, name: editName.trim(), price: priceNum },
    ];
    persistQueue(nextQueue);

    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
    setMode("idle");
    setScannedBarcode(null);
  };

  const removeFromQueue = async (id) => {
    await persistQueue(queue.filter((q) => q.id !== id));
  };

  const clearQueue = async () => {
    await persistQueue([]);
  };

  const makeBarcodeDataUrl = (value) => {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, value, {
      format: "CODE128",
      displayValue: false,
      margin: 4,
      width: 2.5,
      height: 50,
    });
    return canvas.toDataURL("image/png");
  };

  // Rough Excel-width-unit -> pixel and point -> pixel conversions, good enough
  // for sizing a placed image (doesn't need to be exact).
  const colWidthToPx = (w) => Math.round(w * 7 + 5);
  const ptToPx = (pt) => Math.round(pt * (96 / 72));
  // exceljs's fractional `{ col: 1.05 }` image-anchor offset is computed with the
  // wrong units internally (it ends up a few px at most, regardless of the
  // fraction requested), so real centering needs the native EMU offset form
  // instead — same EMU-per-pixel constant exceljs itself uses for image `ext`.
  const EMU_PER_PX = 9525;

  const buildWorkbookBuffer = async (format) => {
    const style = PRICE_TAG_STYLES[format];
    const thinBorder = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
    const rowsPerItem = style.hasBarcode ? 3 : 2;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Cenovnici");
    sheet.columns = Array.from({ length: style.columns }, () => ({ width: style.columnWidth }));
    sheet.pageSetup = { paperSize: 9, orientation: "portrait" }; // 9 = A4

    queue.forEach((item, i) => {
      const col = (i % style.columns) + 1;
      const groupIndex = Math.floor(i / style.columns);
      const nameRow = sheet.getRow(groupIndex * rowsPerItem + 1);
      const priceRow = sheet.getRow(groupIndex * rowsPerItem + 2);
      nameRow.height = style.nameRowHeight;
      priceRow.height = style.priceRowHeight;

      const nameCell = nameRow.getCell(col);
      nameCell.value = item.name;
      nameCell.font = { name: "Bahnschrift SemiBold", bold: true, size: style.nameFontSize };
      nameCell.alignment = style.nameAlignment;
      nameCell.border = thinBorder;

      const priceText = item.price.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const priceCell = priceRow.getCell(col);
      priceCell.value = priceText;
      priceCell.font = { name: "Oswald", bold: false, size: style.priceFontSize(priceText) };
      priceCell.alignment = style.priceAlignment;
      priceCell.border = thinBorder;

      if (style.hasBarcode) {
        const barcodeRow = sheet.getRow(groupIndex * rowsPerItem + 3);
        barcodeRow.height = style.barcodeRowHeight;
        // still draw the border on an (empty) cell so the tag outline stays closed
        barcodeRow.getCell(col).border = thinBorder;

        const imageId = workbook.addImage({
          base64: makeBarcodeDataUrl(item.barcode),
          extension: "png",
        });
        const rowIdx = groupIndex * rowsPerItem + 2; // 0-indexed row number of the barcode row
        const colIdx = col - 1; // 0-indexed
        const colPx = colWidthToPx(style.columnWidth);
        const rowPx = ptToPx(style.barcodeRowHeight);
        const imageWidthPx = colPx * FRUIT_BARCODE_WIDTH_FRACTION;
        const imageHeightPx = rowPx * 0.8;
        const horizontalMarginPx = (colPx - imageWidthPx) / 2; // centers the image in the column
        const verticalMarginPx = (rowPx - imageHeightPx) / 2;
        sheet.addImage(imageId, {
          tl: {
            nativeCol: colIdx,
            nativeColOff: Math.round(horizontalMarginPx * EMU_PER_PX),
            nativeRow: rowIdx,
            nativeRowOff: Math.round(verticalMarginPx * EMU_PER_PX),
          },
          ext: { width: imageWidthPx, height: imageHeightPx },
        });
      }
    });

    return workbook.xlsx.writeBuffer();
  };

  const exportSheet = async (format) => {
    if (queue.length === 0) return;
    const buffer = await buildWorkbookBuffer(format);
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const dateStr = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `price-tags-${format}-${dateStr}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const sendSheetByEmail = async (format) => {
    if (queue.length === 0) return;
    setEmailSending(true);
    setEmailError(null);
    setEmailSent(false);
    try {
      const buffer = await buildWorkbookBuffer(format);
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const base64 = await blobToBase64(blob);
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `price-tags-${format}-${dateStr}.xlsx`;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("no-session");

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ filename, base64 }),
      });
      if (!res.ok) throw new Error("send-failed");

      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } catch (e) {
      console.error("send email failed", e);
      setEmailError("Slanje mejla nije uspelo. Proveri internet konekciju i probaj ponovo.");
    }
    setEmailSending(false);
  };

  const chooseFormatAndRun = (formatKey) => {
    const action = pendingAction;
    setPendingAction(null);
    if (action === "download") exportSheet(formatKey);
    else if (action === "email") sendSheetByEmail(formatKey);
  };

  const total = queue.length;

  return (
    <div
      style={{
        fontFamily: FONT_SANS,
        background: PAPER,
        color: INK,
        minHeight: "100%",
        padding: "20px 16px 40px",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        input:focus { outline: 2px solid ${INK}; outline-offset: 1px; }
      `}</style>

      <header style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 21, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
            Shelf Price Scanner
          </h1>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: MUTE }}>
            {total} queued
          </span>
        </div>
        <p style={{ fontSize: 13, color: MUTE, margin: "4px 0 0" }}>
          Scan an item, set its price, queue it for printing.
        </p>
      </header>

      {mode === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={startScan}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: INK,
              color: PAPER,
              border: "none",
              borderRadius: 10,
              padding: "16px 20px",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Camera size={20} /> Scan barcode
          </button>
          <button
            onClick={() => setMode("manualEntry")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "transparent",
              color: INK,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: "13px 20px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <Keyboard size={16} /> Enter barcode manually
          </button>
        </div>
      )}

      {mode === "scanning" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              position: "relative",
              borderRadius: 10,
              overflow: "hidden",
              background: "#000",
              aspectRatio: "4/3",
            }}
          >
            <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
            <div
              style={{
                position: "absolute",
                inset: "30% 12%",
                border: `2px solid ${PAPER}`,
                borderRadius: 6,
                boxShadow: "0 0 0 999px rgba(0,0,0,0.35)",
              }}
            />
          </div>
          {cameraError && (
            <div style={{ display: "flex", gap: 8, fontSize: 13, color: RED, background: "#FBEAE8", padding: 10, borderRadius: 8 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{cameraError}</span>
            </div>
          )}
          <button
            onClick={cancelScan}
            style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px", fontSize: 14, cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      )}

      {mode === "manualEntry" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 13, color: MUTE }}>Barcode number</label>
          <input
            autoFocus
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitManualBarcode();
            }}
            placeholder="e.g. 4104420000015"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 16,
              padding: "13px 14px",
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: CARD,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={submitManualBarcode}
              disabled={!manualBarcode.trim()}
              style={{
                flex: 1,
                background: manualBarcode.trim() ? INK : BORDER,
                color: PAPER,
                border: "none",
                borderRadius: 10,
                padding: "13px",
                fontSize: 15,
                fontWeight: 600,
                cursor: manualBarcode.trim() ? "pointer" : "not-allowed",
              }}
            >
              Continue
            </button>
            <button
              onClick={() => {
                setManualBarcode("");
                setMode("idle");
              }}
              style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "13px 16px", fontSize: 14, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "editing" && (
        <div
          style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: MUTE, marginBottom: 12 }}>
            {scannedBarcode}
            {lookupLoading ? "  ·  učitavanje…" : isNewProduct ? "  ·  novi artikal" : ""}
          </div>

          {saveError && (
            <div style={{ display: "flex", gap: 8, fontSize: 13, color: RED, background: "#FBEAE8", padding: 10, borderRadius: 8, marginBottom: 12 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{saveError}</span>
            </div>
          )}

          <label style={{ fontSize: 12, color: MUTE }}>Product name</label>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Product name"
            style={{
              width: "100%",
              fontSize: 16,
              padding: "11px 12px",
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              margin: "4px 0 14px",
            }}
          />

          <label style={{ fontSize: 12, color: MUTE }}>Price</label>
          <div style={{ position: "relative", margin: "4px 0 18px" }}>
            <input
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              style={{
                width: "100%",
                fontFamily: FONT_MONO,
                fontSize: 26,
                fontWeight: 600,
                padding: "12px 14px",
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                color: RED,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={saveAndQueue}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: GREEN,
                color: PAPER,
                border: "none",
                borderRadius: 10,
                padding: "13px",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Check size={17} /> Save & add to list
            </button>
            <button
              onClick={() => setMode("idle")}
              style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "13px 16px", fontSize: 14, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {savedFlash && (
        <div style={{ fontSize: 13, color: GREEN, marginTop: 10, fontWeight: 500 }}>Added to print list.</div>
      )}

      <section style={{ marginTop: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, textTransform: "none" }}>Print list</h2>
          {queue.length > 0 && (
            <button
              onClick={clearQueue}
              style={{ background: "none", border: "none", color: MUTE, fontSize: 12, cursor: "pointer", padding: 0 }}
            >
              Clear all
            </button>
          )}
        </div>

        {queue.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTE, border: `1px dashed ${BORDER}`, borderRadius: 10, padding: 16, textAlign: "center" }}>
            Nothing queued yet. Scan an item to add it here.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {queue.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.name}
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTE }}>{item.barcode}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 600, color: RED }}>
                    {item.price.toFixed(2)}
                  </span>
                  <button
                    onClick={() => removeFromQueue(item.id)}
                    style={{ background: "none", border: "none", color: MUTE, cursor: "pointer", padding: 4 }}
                    aria-label="Remove"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setPendingAction("download")}
          disabled={queue.length === 0}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 14,
            background: queue.length === 0 ? BORDER : INK,
            color: PAPER,
            border: "none",
            borderRadius: 10,
            padding: "14px",
            fontSize: 15,
            fontWeight: 600,
            cursor: queue.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          <Download size={18} /> Download price sheet (.xlsx)
        </button>

        <button
          onClick={() => setPendingAction("email")}
          disabled={queue.length === 0 || emailSending}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 8,
            background: "transparent",
            color: INK,
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            padding: "13px",
            fontSize: 14,
            fontWeight: 500,
            cursor: queue.length === 0 || emailSending ? "not-allowed" : "pointer",
            opacity: queue.length === 0 || emailSending ? 0.6 : 1,
          }}
        >
          <Mail size={16} /> {emailSending ? "Slanje…" : "Send by email"}
        </button>

        {emailError && (
          <div style={{ display: "flex", gap: 8, fontSize: 13, color: RED, background: "#FBEAE8", padding: 10, borderRadius: 8, marginTop: 10 }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{emailError}</span>
          </div>
        )}
        {emailSent && (
          <div style={{ fontSize: 13, color: GREEN, marginTop: 10, fontWeight: 500 }}>E-mail poslat.</div>
        )}

        <p style={{ fontSize: 11.5, color: MUTE, marginTop: 8, lineHeight: 1.5 }}>
          Downloads straight to this device — share it to email or print from there. Layout is a placeholder until your real template is added.
        </p>
      </section>

      {pendingAction && (
        <div
          onClick={() => setPendingAction(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(31,27,22,0.4)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 480,
              background: CARD,
              borderRadius: "16px 16px 0 0",
              padding: "10px 16px 24px",
            }}
          >
            <div style={{ width: 36, height: 4, background: BORDER, borderRadius: 2, margin: "4px auto 16px" }} />
            <p style={{ fontSize: 13, color: MUTE, margin: "0 0 12px", textAlign: "center" }}>
              {pendingAction === "download" ? "Preuzmi cenovnik za:" : "Pošalji cenovnik za:"}
            </p>
            {Object.entries(PRICE_TAG_STYLES).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => chooseFormatAndRun(key)}
                style={{
                  width: "100%",
                  background: "transparent",
                  color: INK,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  padding: "14px",
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: "pointer",
                  marginBottom: 8,
                }}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setPendingAction(null)}
              style={{
                width: "100%",
                background: "none",
                border: "none",
                color: MUTE,
                fontSize: 14,
                padding: "10px",
                cursor: "pointer",
              }}
            >
              Otkaži
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
