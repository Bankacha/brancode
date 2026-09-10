import React, { useState, useRef, useEffect, useCallback } from "react";
import { Scan, X, Plus, Download, Check, Camera, Keyboard, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";

const FONT_SANS = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

const PAPER = "#FAF7F0";
const INK = "#1F1B16";
const RED = "#C1443C";
const GREEN = "#5B7A6A";
const MUTE = "#8A8073";
const BORDER = "#DED7C6";
const CARD = "#FFFFFF";

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

  const openProduct = async (barcode) => {
    setScannedBarcode(barcode);
    setEditName("");
    setEditPrice("");
    setIsNewProduct(false);
    setSaveError(null);
    setMode("editing");
    setLookupLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("name, price")
        .eq("barcode", barcode)
        .maybeSingle();
      if (error) throw error;
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

  const exportSheet = () => {
    if (queue.length === 0) return;
    const rows = [];
    const merges = [];
    let r = 0;
    queue.forEach((item) => {
      rows[r] = [item.name];
      merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
      r += 1;
      rows[r] = [
        item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ];
      merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
      r += 1;
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!merges"] = merges;
    ws["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }];
    const rowInfo = [];
    for (let i = 0; i < rows.length; i += 2) {
      rowInfo[i] = { hpt: 34 }; // name row ~ smaller
      rowInfo[i + 1] = { hpt: 82 }; // price row ~ bigger, total approximates 4cm
    }
    ws["!rows"] = rowInfo;
    ws["!pageSetup"] = { paperSize: 9, orientation: "portrait" }; // 9 = A4

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Price Tags");
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `price-tags-${dateStr}.xlsx`);
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
          onClick={exportSheet}
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
        <p style={{ fontSize: 11.5, color: MUTE, marginTop: 8, lineHeight: 1.5 }}>
          Downloads straight to this device — share it to email or print from there. Layout is a placeholder until your real template is added.
        </p>
      </section>
    </div>
  );
}
