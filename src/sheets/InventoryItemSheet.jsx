import { useState } from "react";
import { Lock } from "lucide-react";
import BottomSheet from "../components/BottomSheet.jsx";
import Button from "../components/Button.jsx";
import Field from "../components/Field.jsx";
import { formatQuantity } from "../lib/listFormat.js";

// Buttons per place the flow was started from: the list (one save), the
// camera (save and scan the next, or finish) or the keypad.
const ACTIONS = {
  list: { item: [["Sačuvaj", "close"]], add: [["Dodaj", "close"]] },
  scan: {
    item: [["Sačuvaj i skeniraj sledeći", "next"], ["Sačuvaj i završi", "finish"]],
    add: [["Dodaj i skeniraj sledeći", "next"], ["Dodaj i završi", "finish"]],
  },
  manual: {
    item: [["Sačuvaj i upiši sledeći", "next"], ["Sačuvaj i zatvori", "finish"]],
    add: [["Dodaj i upiši sledeći", "next"], ["Dodaj i zatvori", "finish"]],
  },
};

function FieldError({ text }) {
  return text ? (
    <p role="alert" className="-mt-1 px-1 text-[13px] font-semibold text-danger-ink">
      {text}
    </p>
  ) : null;
}

function Buttons({ actions, saving, onSubmit }) {
  return actions.map(([label, then], i) => (
    <Button key={then} type={i === 0 ? "submit" : "button"} variant={i === 0 ? "accent" : "dark"} size={i === 0 ? "lg" : "md"} disabled={saving} onClick={i === 0 ? undefined : () => onSubmit(then)} className="w-full">
      {label}
    </Button>
  ));
}

// The popis item flow in one sheet: its content follows the flow's state
// (looking up → fill in, or already on the popis → add a quantity / edit).
export default function InventoryItemSheet({ flow, open, onClose, source, onSubmit }) {
  const { state } = flow;
  const [saving, setSaving] = useState(false);
  const actions = ACTIONS[source];

  const submit = async (then) => {
    if (saving) return;
    setSaving(true);
    try {
      await onSubmit(then);
    } finally {
      setSaving(false);
    }
  };
  const onFormSubmit = (kind) => (e) => {
    e.preventDefault();
    submit(actions[kind][0][1]);
  };
  const field = (key) => ({ value: state[key], onChange: (e) => flow.setField(key, e.target.value) });

  return (
    <BottomSheet open={open} onClose={onClose} dismissible={!saving}>
      {state.kind === "loading" && (
        <>
          <p className="font-mono text-[13px] text-ink-3">{state.code}</p>
          <p className="text-[17px] font-semibold text-ink-2">Tražim artikal…</p>
        </>
      )}

      {(state.kind === "new" || state.kind === "edit") && (
        <form onSubmit={onFormSubmit("item")} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[13px] text-ink-3">{state.kind === "new" ? state.barcode : state.item.barcode}</p>
            <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${state.locked ? "bg-success-bg text-ink-2" : "bg-danger-bg text-danger-ink"}`}>
              {state.locked ? "Iz baze artikala" : "Nije u bazi"}
            </span>
          </div>
          <Field label="Naziv" {...field("name")} readOnly={state.locked} suffix={state.locked ? <Lock size={16} /> : null} autoComplete="off" />
          <FieldError text={state.errors.name} />
          <Field label="Cena" {...field("price")} readOnly={state.locked} inputMode="decimal" suffix={state.locked ? <Lock size={16} /> : "din"} autoComplete="off" />
          <FieldError text={state.errors.price} />
          <Field label="Količina na stanju" {...field("quantity")} inputMode="decimal" autoFocus autoComplete="off" />
          <FieldError text={state.errors.quantity} />
          <Buttons actions={actions.item} saving={saving} onSubmit={submit} />
        </form>
      )}

      {state.kind === "duplicate" && (
        <>
          <h2 className="font-display text-[24px] leading-tight font-extrabold text-ink">Artikal je već na popisu</h2>
          <p className="text-[15px] text-ink-2">
            <span className="font-semibold text-ink">{state.item.name}</span> · na popisu: {formatQuantity(state.item.quantity)}
          </p>
          <p className="text-[14px] text-ink-3">Dodati količinu ili izmeniti stavku?</p>
          <Button onClick={flow.chooseAdd} className="w-full">
            Dodaj količinu
          </Button>
          <Button variant="outline" size="md" onClick={flow.chooseEdit} className="w-full">
            Izmeni stavku
          </Button>
          <Button variant="text" size="md" onClick={onClose} className="w-full">
            Otkaži
          </Button>
        </>
      )}

      {state.kind === "add" && (
        <form onSubmit={onFormSubmit("add")} className="flex flex-col gap-3">
          <h2 className="font-display text-[24px] font-extrabold text-ink">Dodaj količinu</h2>
          <p className="text-[15px] text-ink-2">
            <span className="font-semibold text-ink">{state.item.name}</span> · na popisu: {formatQuantity(state.item.quantity)}
          </p>
          <Field label="Koliko dodaješ" {...field("amount")} inputMode="decimal" autoFocus autoComplete="off" />
          <FieldError text={state.errors.amount} />
          <Buttons actions={actions.add} saving={saving} onSubmit={submit} />
        </form>
      )}
    </BottomSheet>
  );
}
