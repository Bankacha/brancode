import { useEffect, useRef } from "react";
import { ScanBarcode } from "lucide-react";
import BottomSheet from "../components/BottomSheet.jsx";
import Button from "../components/Button.jsx";
import Field from "../components/Field.jsx";
import PriceTag from "../components/PriceTag.jsx";
import ScaledToWidth from "../components/ScaledToWidth.jsx";
import { parsePrice } from "../lib/format.js";
import { tagGeometry } from "../lib/priceTags.js";

const badgeStyles = {
  "U bazi": "bg-success-bg text-success-ink",
  "Novi artikal": "bg-danger-bg text-danger-ink",
  "Nije u bazi": "bg-danger-bg text-danger-ink",
};

const WHERE = { shelf: "na rafu", fridge: "u frižideru", fruit: "za voće" };

// The tag as it will print in the chosen format, updated while typing
// (spec decision 4: drop this block if paper and preview ever disagree).
function TagPreview({ editor, format }) {
  const { widthMm, heightMm } = tagGeometry(format);
  const item = { name: editor.name || "—", price: parsePrice(editor.price) ?? 0, barcode: editor.barcode ?? "" };
  return (
    <div>
      <div className="flex justify-center rounded-tag-frame bg-surface-muted p-4">
        <div className="w-[210px] shadow-tag">
          <ScaledToWidth widthMm={widthMm} heightMm={heightMm}>
            <PriceTag item={item} format={format} />
          </ScaledToWidth>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-ink-3">{`Ovako izgleda cenovnik ${WHERE[format]}`}</p>
    </div>
  );
}

// Handoff "03" (a scanned/typed article that's already in the database: a
// quick price check) and "04" (new article, or opened from the list: with
// the tag preview). Buttons follow the spec's table for where it was opened.
// source: "scan" | "manual" | "list".
export default function EditSheet({ editor, open, onClose, format, source = "list", sessionCount = 0, onSave, onSaveNext, onSkip, onFinish }) {
  const nameRef = useRef(null);
  const priceRef = useRef(null);
  const quickCheck = source !== "list" && editor.badge === "U bazi";
  const disabled = !editor.canSave;

  // Once the lookup settles: a known product goes straight to the price,
  // a new one to its name.
  useEffect(() => {
    if (!open || editor.loading) return;
    const target = editor.name ? priceRef.current : nameRef.current;
    target?.focus();
    target?.select();
  }, [open, editor.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BottomSheet open={open} onClose={onClose} dismissible={!editor.saving} closeOnScrim={source !== "scan"}>
      <div className="flex items-center gap-2.5">
        {editor.loading ? (
          <span className="text-xs font-semibold text-ink-3">Tražim u bazi…</span>
        ) : (
          editor.badge && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeStyles[editor.badge]}`}>{editor.badge}</span>
        )}
        <span className="font-mono text-xs text-ink-3">{editor.barcode}</span>
        {source === "scan" && <span className="ml-auto text-xs font-medium text-ink-3">{`${sessionCount}. u nizu`}</span>}
      </div>
      {editor.error === "lookup" && (
        <p className="text-[13px] text-danger-ink">Ne mogu da se povežem sa bazom. Proveri internet konekciju.</p>
      )}
      {!quickCheck && <TagPreview editor={editor} format={format} />}
      <Field ref={nameRef} label="Naziv" value={editor.name} onChange={(e) => editor.setName(e.target.value)} />
      <Field
        ref={priceRef}
        label={quickCheck && editor.oldPrice ? `Cena · bila ${editor.oldPrice}` : "Cena"}
        inputMode="decimal"
        suffix="din"
        value={editor.price}
        onChange={(e) => editor.setPrice(e.target.value)}
        inputClassName="font-display text-[36px] leading-[1.1] font-extrabold"
      />

      {source === "list" && (
        <Button variant="accent" disabled={disabled} onClick={onSave} className="mt-1 w-full">
          Sačuvaj i zatvori
        </Button>
      )}

      {source !== "list" && (
        <Button variant="accent" icon={source === "scan" ? ScanBarcode : undefined} disabled={disabled} onClick={onSaveNext} className="mt-1 w-full">
          {source === "scan" ? "Sačuvaj i skeniraj sledeći" : "Sačuvaj i upiši sledeći"}
        </Button>
      )}

      {source === "scan" && quickCheck ? (
        <div className="flex items-center justify-between">
          <Button variant="text" size="md" disabled={disabled} onClick={onSkip} className="px-0">
            Preskoči
          </Button>
          <Button variant="text" size="md" disabled={disabled} onClick={onFinish} className="px-0 text-ink">
            {`Sačuvaj i završi (${sessionCount})`}
          </Button>
        </div>
      ) : (
        source !== "list" && (
          <Button variant="text" size="md" disabled={disabled} onClick={onFinish} className="w-full">
            Sačuvaj i zatvori
          </Button>
        )
      )}
    </BottomSheet>
  );
}
