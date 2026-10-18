import { useEffect, useState } from "react";
import BottomSheet from "../components/BottomSheet.jsx";
import Button from "../components/Button.jsx";
import Field from "../components/Field.jsx";
import { inventoryTitle, monthStartIso, todayIso } from "../lib/listFormat.js";

const emptyForm = () => ({ title: "", dateFrom: monthStartIso(), dateTo: todayIso() });

// New popis, or renaming one (the pencil on the list): optional text and a
// period, with the resulting name shown as it will appear.
export default function InventoryFormSheet({ open, onClose, initial, heading, submitLabel, saving, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? { title: initial.title, dateFrom: initial.dateFrom, dateTo: initial.dateTo } : emptyForm());
    setError(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    if (!form.dateFrom || !form.dateTo) return setError("Izaberi oba datuma.");
    if (form.dateTo < form.dateFrom) return setError("Datum „do“ ne može biti pre datuma „od“.");
    setError(null);
    onSubmit({ title: form.title.trim(), dateFrom: form.dateFrom, dateTo: form.dateTo });
  };

  const complete = form.dateFrom && form.dateTo;
  return (
    <BottomSheet open={open} onClose={onClose} dismissible={!saving}>
      <h2 className="font-display text-[26px] font-extrabold text-ink">{heading}</h2>
      <Field label="Tekst (nije obavezno)" value={form.title} onChange={set("title")} maxLength={60} autoComplete="off" />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Od" type="date" value={form.dateFrom} onChange={set("dateFrom")} />
        <Field label="Do" type="date" value={form.dateTo} onChange={set("dateTo")} />
      </div>
      {complete && (
        <p className="text-[14px] text-ink-3">
          Naziv: <span className="font-semibold text-ink">{inventoryTitle(form)}</span>
        </p>
      )}
      {error && (
        <p role="alert" className="text-[14px] font-semibold text-danger-ink">
          {error}
        </p>
      )}
      <Button onClick={submit} disabled={saving} className="mt-1 w-full">
        {submitLabel}
      </Button>
    </BottomSheet>
  );
}
