import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, KeyRound } from "lucide-react";
import { efakturaCall, efakturaErrorText } from "../lib/efaktura.js";
import { leaveScreen } from "../lib/navigation.js";
import { useLoad } from "../lib/useLoad.js";
import { useDialog } from "../lib/useSheet.js";
import { useToast } from "../components/Toast.jsx";
import Button from "../components/Button.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Field from "../components/Field.jsx";
import IconButton from "../components/IconButton.jsx";
import LoadError from "../components/LoadError.jsx";

const PIB = /^\d{9}$/;

export function MockBanner() {
  return <p className="rounded-card bg-surface-muted px-4 py-3 text-[13px] font-semibold text-ink-2">Probni režim: izmišljene fakture, SEF se ne poziva.</p>;
}

// /e-faktura/podesavanja: the SEF API key (sent once to the server, which
// checks it with SEF and keeps it sealed; the app only ever sees its last four
// characters), the shop's name and PIB, and where invoices are sent.
export default function EfakturaSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const removeDialog = useDialog("remove-key");
  const status = useLoad(() => efakturaCall("status"), []);
  const [info, setInfo] = useState(null);
  const [shopName, setShopName] = useState("");
  const [pib, setPib] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const filled = useRef(false);

  useEffect(() => {
    if (!status.data || filled.current) return;
    filled.current = true;
    setInfo(status.data);
    setShopName(status.data.shopName ?? "");
    setPib(status.data.pib ?? "");
  }, [status.data]);

  const back = () => leaveScreen(navigate, location, "/e-faktura");
  const header = (
    <header className="flex items-start gap-3">
      <IconButton label="Nazad" icon={ArrowLeft} onClick={back} />
      <div className="min-w-0 flex-1 pt-1">
        <h1 className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em] text-ink">e-Faktura</h1>
        <p className="text-[13px] text-ink-3">Podešavanja</p>
      </div>
    </header>
  );

  if (!info) {
    return (
      <div className="px-5 pt-[calc(16px+env(safe-area-inset-top))]">
        {header}
        {status.error ? (
          <LoadError text={efakturaErrorText(status.error.code)} onRetry={status.reload} />
        ) : (
          <p className="mt-8 text-center text-[15px] text-ink-3">Učitavanje…</p>
        )}
      </div>
    );
  }

  const keyField = !info.connected || replacing;
  const nameOk = shopName.trim().length > 0 && shopName.trim().length <= 100;
  const canSave = nameOk && PIB.test(pib) && (!keyField || apiKey.trim() !== "") && !busy;

  const save = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    try {
      const next = await efakturaCall("save-settings", { shopName: shopName.trim(), pib, ...(keyField && { apiKey: apiKey.trim() }) });
      setInfo(next);
      setApiKey("");
      setReplacing(false);
      toast.show({ kind: "success", text: "Sačuvano" });
    } catch (err) {
      toast.show({ kind: "error", text: efakturaErrorText(err.code) });
    } finally {
      setBusy(false);
    }
  };

  const removeKey = async () => {
    setBusy(true);
    try {
      setInfo(await efakturaCall("remove-key"));
      setReplacing(false);
      removeDialog.close();
      toast.show({ kind: "success", text: "Ključ uklonjen" });
    } catch (err) {
      toast.show({ kind: "error", text: efakturaErrorText(err.code) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col gap-5 px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(32px+env(safe-area-inset-bottom))]">
      {header}
      {info.mode === "mock" && <MockBanner />}

      <form onSubmit={save} className="flex flex-col gap-3">
        <Field label="Naziv radnje" value={shopName} onChange={(e) => setShopName(e.target.value)} maxLength={100} autoComplete="off" enterKeyHint="next" />
        <Field
          label="PIB"
          value={pib}
          onChange={(e) => setPib(e.target.value.replace(/\D/g, "").slice(0, 9))}
          inputMode="numeric"
          maxLength={9}
          autoComplete="off"
          enterKeyHint={keyField ? "next" : "done"}
        />

        {keyField ? (
          <div className="flex flex-col gap-1.5">
            <Field
              label="API ključ sa SEF-a"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
            />
            <p className="px-1 text-[13px] text-ink-3">SEF → Podešavanja → API menadžment → Generiši ključ, pa status „Aktivan“.</p>
            {info.mode === "mock" && <p className="px-1 text-[13px] text-ink-3">U probnom režimu upiši bilo koji tekst, ne pravi ključ.</p>}
            {replacing && (
              <Button variant="text" size="md" onClick={() => (setReplacing(false), setApiKey(""))} className="self-start">
                Odustani od zamene
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-card bg-surface-muted px-4 py-3">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <KeyRound size={18} className="text-ink-2" />
              {`Ključ sačuvan · završava se na …${info.keyLast4}`}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="md" onClick={() => setReplacing(true)}>
                Zameni ključ
              </Button>
              <Button variant="text" size="md" onClick={removeDialog.open}>
                Ukloni ključ
              </Button>
            </div>
          </div>
        )}

        <Button type="submit" variant="accent" disabled={!canSave} className="w-full">
          Proveri i sačuvaj
        </Button>
      </form>

      {info.connected && (
        <div className="flex flex-col gap-1.5">
          <Field label="Fakture šalji na" value={info.sendTo ?? ""} disabled readOnly inputClassName="text-ink-3" />
          <p className="px-1 text-[13px] text-ink-3">Slanje na drugu adresu, npr. knjigovođi, biće moguće uskoro.</p>
        </div>
      )}

      <ConfirmDialog
        open={removeDialog.isOpen}
        title="Ukloniti ključ?"
        text="Dok se ne unese nov ključ, e-Faktura neće moći da čita fakture sa SEF-a."
        confirmLabel="Ukloni"
        busy={busy}
        onConfirm={removeKey}
        onClose={removeDialog.close}
      />
    </div>
  );
}
