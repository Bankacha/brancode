import { useEffect, useRef } from "react";
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

// Handoff "04 · Izmena".
export default function EditSheet({ editor, open, onClose, onSave, format }) {
  const nameRef = useRef(null);
  const priceRef = useRef(null);

  // Once the lookup settles: a known product goes straight to the price,
  // a new one to its name.
  useEffect(() => {
    if (!open || editor.loading) return;
    const target = editor.name ? priceRef.current : nameRef.current;
    target?.focus();
    target?.select();
  }, [open, editor.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BottomSheet open={open} onClose={onClose} dismissible={!editor.saving}>
      <div className="flex items-center gap-2.5">
        {editor.loading ? (
          <span className="text-xs font-semibold text-ink-3">Tražim u bazi…</span>
        ) : (
          editor.badge && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeStyles[editor.badge]}`}>{editor.badge}</span>
        )}
        <span className="font-mono text-xs text-ink-3">{editor.barcode}</span>
      </div>
      {editor.error === "lookup" && (
        <p className="text-[13px] text-danger-ink">Ne mogu da se povežem sa bazom. Proveri internet konekciju.</p>
      )}
      <TagPreview editor={editor} format={format} />
      <Field ref={nameRef} label="Naziv" value={editor.name} onChange={(e) => editor.setName(e.target.value)} />
      <Field
        ref={priceRef}
        label="Cena"
        inputMode="decimal"
        suffix="din"
        value={editor.price}
        onChange={(e) => editor.setPrice(e.target.value)}
        inputClassName="font-display text-[36px] leading-[1.1] font-extrabold"
      />
      <Button variant="accent" disabled={!editor.canSave} onClick={onSave} className="mt-1 w-full">
        Sačuvaj i zatvori
      </Button>
    </BottomSheet>
  );
}
