import { useEffect, useState } from "react";
import BottomSheet from "../components/BottomSheet.jsx";
import Button from "../components/Button.jsx";
import Field from "../components/Field.jsx";
import DateField from "../components/DateField.jsx";
import { requisitionTitle, todayIso } from "../lib/listFormat.js";

const emptyForm = () => ({ title: "", date: todayIso() });

// New trebovanje (also the target of "Prenesi stavke"), or renaming one: a
// date (today by default) and optional text, with the resulting name shown.
export default function RequisitionFormSheet({ open, onClose, initial, heading, submitLabel, saving, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? { title: initial.title, date: initial.date } : emptyForm());
    setError(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    if (!form.date) return setError("Izaberi datum.");
    setError(null);
    onSubmit({ title: form.title.trim(), date: form.date });
  };

  return (
    <BottomSheet open={open} onClose={onClose} dismissible={!saving}>
      <h2 className="font-display text-[26px] font-extrabold text-ink">{heading}</h2>
      <Field label="Tekst (nije obavezno)" value={form.title} onChange={set("title")} maxLength={60} autoComplete="off" />
      <DateField label="Datum" value={form.date} onChange={set("date")} />
      {form.date && (
        <p className="text-[14px] text-ink-3">
          Naziv: <span className="font-semibold text-ink">{requisitionTitle(form)}</span>
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
