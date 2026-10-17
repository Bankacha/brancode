import React, { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { X, Download, Check, Camera, Keyboard, AlertCircle, Mail, FileUp } from "lucide-react";
import { parseLeafletPdf, matchLeafletRows, saveLeafletPrices } from "../promoLeaflet.js";
import { PRICE_TAG_STYLES, buildWorkbookBuffer, sheetFilename } from "../lib/priceTags.js";
import { sendSheetByEmail } from "../lib/email.js";
import BottomSheet from "../sheets/BottomSheet.jsx";
import {
  FONT_SANS,
  FONT_MONO,
  PAPER,
  INK,
  RED,
  GREEN,
  MUTE,
  BORDER,
  CARD,
  secondaryHalfButton,
  sheetOptionButton,
  sheetPrimaryButton,
  sheetCancelButton,
  sheetMessage,
  errorBanner,
  outlineButton,
} from "../lib/legacyTheme.js";

export default function Home({ queue, setQueue, editor }) {
  const navigate = useNavigate();
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [emailSent, setEmailSent] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // null | "download" | "email"
  const [importStep, setImportStep] = useState(null); // null | "confirmClear" | "reading" | "confirm" | "saving"
  const [importMatches, setImportMatches] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importNotice, setImportNotice] = useState(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const leafletInputRef = useRef(null);

  const removeFromQueue = (id) => setQueue(queue.filter((q) => q.id !== id));

  const exportSheet = async (format) => {
    if (queue.length === 0) return;
    const buffer = await buildWorkbookBuffer(queue, format);
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sheetFilename(format);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const emailSheet = async (format) => {
    if (queue.length === 0) return;
    setEmailSending(true);
    setEmailError(null);
    setEmailSent(false);
    try {
      await sendSheetByEmail(sheetFilename(format), await buildWorkbookBuffer(queue, format));
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
    else if (action === "email") emailSheet(formatKey);
  };

  // The file picker must open synchronously inside a click handler (browsers
  // block programmatic file dialogs outside a user gesture), so no awaits here.
  const startLeafletImport = () => {
    setImportError(null);
    setImportNotice(null);
    if (queue.length > 0) {
      setImportStep("confirmClear");
      return;
    }
    leafletInputRef.current.click();
  };

  const clearAndStartLeafletImport = () => {
    setQueue([]);
    setImportStep(null);
    leafletInputRef.current.click();
  };

  // The PDF is only read in memory here — never uploaded or stored anywhere.
  const onLeafletFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportStep("reading");
    try {
      const rows = await parseLeafletPdf(await file.arrayBuffer());
      setImportMatches(await matchLeafletRows(rows));
      setImportStep("confirm");
    } catch (err) {
      console.error("leaflet read failed", err);
      setImportError(err.userFacing ? err.message : "Čitanje lifleta nije uspelo. Proveri internet konekciju i probaj ponovo.");
      setImportStep(null);
    }
  };

  const confirmLeafletImport = async () => {
    setImportStep("saving");
    try {
      await saveLeafletPrices(importMatches);
      const stamp = Date.now();
      // Every leaflet article goes on the list (the user prunes it with X);
      // ones we don't carry are flagged so they're easy to spot.
      const imported = importMatches.map(({ ean, name, price, existing }, i) => ({
        id: `${ean}-${stamp}-${i}`,
        barcode: ean,
        name: existing ? existing.name : name,
        price,
        notInDb: !existing,
      }));
      setQueue(imported);
      setImportNotice(`Uvezeno iz lifleta u listu za štampu: ${imported.length}`);
      setTimeout(() => setImportNotice(null), 4000);
    } catch (err) {
      console.error("leaflet save failed", err);
      setImportError("Čuvanje akcijskih cena nije uspelo. Proveri internet konekciju i probaj ponovo.");
    }
    setImportMatches(null);
    setImportStep(null);
  };

  const cancelLeafletImport = () => {
    setImportMatches(null);
    setImportStep(null);
  };

  return (
    <>
      {editor.barcode === null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => navigate("/skeniranje")}
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
            <Camera size={20} /> Skeniraj barkod
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => navigate("/rucni-unos")} style={secondaryHalfButton}>
              <Keyboard size={16} /> Ručni unos
            </button>
            <button onClick={startLeafletImport} style={secondaryHalfButton}>
              <FileUp size={16} /> Akcijski liflet
            </button>
          </div>
        </div>
      )}

      {importError && (
        <div style={{ ...errorBanner, marginTop: 10 }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{importError}</span>
        </div>
      )}
      {importNotice && <div style={{ fontSize: 13, color: GREEN, marginTop: 10, fontWeight: 500 }}>{importNotice}</div>}

      <input ref={leafletInputRef} type="file" accept="application/pdf" onChange={onLeafletFileChosen} style={{ display: "none" }} />

      {editor.barcode !== null && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: MUTE, marginBottom: 12 }}>
            {editor.barcode}
            {editor.loading ? "  ·  učitavanje…" : editor.isNew ? "  ·  novi artikal" : ""}
          </div>

          {editor.error && (
            <div style={{ ...errorBanner, marginBottom: 12 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{editor.error}</span>
            </div>
          )}

          <label style={{ fontSize: 12, color: MUTE }}>Naziv artikla</label>
          <input
            value={editor.name}
            onChange={(e) => editor.setName(e.target.value)}
            placeholder="Naziv artikla"
            style={{
              width: "100%",
              fontSize: 16,
              padding: "11px 12px",
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              margin: "4px 0 14px",
            }}
          />

          <label style={{ fontSize: 12, color: MUTE }}>Cena</label>
          <div style={{ position: "relative", margin: "4px 0 18px" }}>
            <input
              value={editor.price}
              onChange={(e) => editor.setPrice(e.target.value)}
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
              onClick={editor.save}
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
              <Check size={17} /> Sačuvaj i dodaj u listu
            </button>
            <button onClick={editor.cancel} style={outlineButton}>
              Otkaži
            </button>
          </div>
        </div>
      )}

      {editor.savedFlash && <div style={{ fontSize: 13, color: GREEN, marginTop: 10, fontWeight: 500 }}>Dodato u listu za štampu.</div>}

      <section style={{ marginTop: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, textTransform: "none" }}>Lista za štampu</h2>
          {queue.length > 0 && (
            <button
              onClick={() => setConfirmClearAll(true)}
              style={{ background: "none", border: "none", color: MUTE, fontSize: 12, cursor: "pointer", padding: 0 }}
            >
              Obriši sve
            </button>
          )}
        </div>

        {queue.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTE, border: `1px dashed ${BORDER}`, borderRadius: 10, padding: 16, textAlign: "center" }}>
            Lista je prazna — skeniraj artikal da ga dodaš ovde.
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
                  <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTE }}>
                    {item.barcode}
                    {item.notInDb && <span style={{ fontFamily: FONT_SANS, color: RED, marginLeft: 6 }}>· nije u bazi</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 600, color: RED }}>{item.price.toFixed(2)}</span>
                  <button
                    onClick={() => removeFromQueue(item.id)}
                    style={{ background: "none", border: "none", color: MUTE, cursor: "pointer", padding: 4 }}
                    aria-label="Ukloni"
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
          <Download size={18} /> Preuzmi cenovnik (.xlsx)
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
          <Mail size={16} /> {emailSending ? "Slanje…" : "Pošalji mejlom"}
        </button>

        {emailError && (
          <div style={{ ...errorBanner, marginTop: 10 }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{emailError}</span>
          </div>
        )}
        {emailSent && <div style={{ fontSize: 13, color: GREEN, marginTop: 10, fontWeight: 500 }}>E-mail poslat.</div>}

        <p style={{ fontSize: 11.5, color: MUTE, marginTop: 8, lineHeight: 1.5 }}>
          Preuzimanje čuva cenovnik na ovom uređaju, a slanje ga šalje na mejl radnje — odatle se štampa.
        </p>
      </section>

      {pendingAction && (
        <BottomSheet onClose={() => setPendingAction(null)}>
          <p style={{ fontSize: 13, color: MUTE, margin: "0 0 12px", textAlign: "center" }}>
            {pendingAction === "download" ? "Preuzmi cenovnik za:" : "Pošalji cenovnik za:"}
          </p>
          {Object.entries(PRICE_TAG_STYLES).map(([key, { label }]) => (
            <button key={key} onClick={() => chooseFormatAndRun(key)} style={sheetOptionButton}>
              {label}
            </button>
          ))}
          <button onClick={() => setPendingAction(null)} style={sheetCancelButton}>
            Otkaži
          </button>
        </BottomSheet>
      )}

      {confirmClearAll && (
        <BottomSheet onClose={() => setConfirmClearAll(false)}>
          <p style={sheetMessage}>Obrisati sve artikle iz liste za štampu ({queue.length})?</p>
          <button
            onClick={() => {
              setQueue([]);
              setConfirmClearAll(false);
            }}
            style={{ ...sheetPrimaryButton, background: RED }}
          >
            Obriši sve
          </button>
          <button onClick={() => setConfirmClearAll(false)} style={sheetCancelButton}>
            Otkaži
          </button>
        </BottomSheet>
      )}

      {importStep === "confirmClear" && (
        <BottomSheet onClose={cancelLeafletImport}>
          <p style={sheetMessage}>Lista za štampu nije prazna. Pre uvoza akcijskih cena odštampaj ili očisti trenutnu listu.</p>
          <button onClick={clearAndStartLeafletImport} style={sheetPrimaryButton}>
            Očisti listu i nastavi
          </button>
          <button onClick={cancelLeafletImport} style={sheetCancelButton}>
            Otkaži
          </button>
        </BottomSheet>
      )}

      {(importStep === "reading" || importStep === "saving") && (
        <BottomSheet>
          <p style={{ ...sheetMessage, color: MUTE, margin: "8px 0 12px" }}>
            {importStep === "reading" ? "Čitam liflet…" : "Čuvam akcijske cene…"}
          </p>
        </BottomSheet>
      )}

      {importStep === "confirm" && importMatches && (
        <BottomSheet onClose={cancelLeafletImport}>
          <p style={{ ...sheetMessage, fontWeight: 600, marginBottom: 10 }}>Akcijski liflet</p>
          <div style={{ fontSize: 14, color: INK, lineHeight: 1.7, marginBottom: 16 }}>
            <div>
              Artikala u lifletu: <strong>{importMatches.length}</strong>
            </div>
            <div>
              Imamo u bazi, cena se ažurira: <strong>{importMatches.filter((m) => m.existing).length}</strong>
            </div>
            <div>
              Nemamo u bazi, samo u listu: <strong>{importMatches.filter((m) => !m.existing).length}</strong>
            </div>
          </div>
          <p style={{ fontSize: 12, color: MUTE, margin: "-6px 0 16px", lineHeight: 1.5 }}>
            Svi artikli idu u listu za štampu — nepotrebne ukloni sa X pre štampe.
          </p>
          <button onClick={confirmLeafletImport} style={sheetPrimaryButton}>
            Uvezi i dodaj u listu
          </button>
          <button onClick={cancelLeafletImport} style={sheetCancelButton}>
            Otkaži
          </button>
        </BottomSheet>
      )}
    </>
  );
}
