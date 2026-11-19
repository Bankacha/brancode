import { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { RefreshCw, RotateCcw, Settings2 } from "lucide-react";
import { efakturaCall, efakturaErrorText, efakturaPdf } from "../lib/efaktura.js";
import { belgradeDateOf, fakture, fakturu, formatAmount, groupByDay, invoicesTotal, pdfFilename, statusLabel, tabInvoices } from "../lib/efakturaRules.js";
import { downloadBlob } from "../lib/download.js";
import { plural } from "../lib/plural.js";
import { useLoad } from "../lib/useLoad.js";
import { useDialog, useDropStaleSheet, useSheet } from "../lib/useSheet.js";
import { useToast } from "../components/Toast.jsx";
import AppHeader from "../components/AppHeader.jsx";
import Button from "../components/Button.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import IconButton from "../components/IconButton.jsx";
import InvoiceRow from "../components/InvoiceRow.jsx";
import LoadError from "../components/LoadError.jsx";
import RejectDialog from "../components/RejectDialog.jsx";
import InvoiceSheet from "../sheets/InvoiceSheet.jsx";
import { MockBanner } from "./EfakturaSettings.jsx";

const TABS = [
  { key: "pending", label: "Na čekanju" },
  { key: "accepted", label: "Prihvaćene" },
  { key: "all", label: "Sve" },
];
const SEND_GROUPS = [
  { state: "unsent", title: "Nije poslato" },
  { state: "sent", title: "Poslato" },
  { state: "before", title: "Pre povezivanja" },
];
// Invoices per request: the server takes up to 50, but each one costs SEF
// calls (3 a second) and sending also fetches a PDF, so parts stay small
// enough to finish well inside the function's time limit.
const ACCEPT_PART = 20;
const SEND_PART = 10;
const EMPTY = {
  pending: "Nema faktura na čekanju.",
  accepted: "Nema prihvaćenih faktura u poslednjih 60 dana.",
  all: "Nema faktura u poslednjih 60 dana.",
};

const newestFirst = (a, b) => String(b.receivedAt ?? "").localeCompare(String(a.receivedAt ?? ""));

const invoiceLabel = (invoice) => `${invoice.supplier} – ${invoice.number}`;

// Why one invoice of a batch didn't go through.
const outcomeText = (result) => {
  if (result?.outcome === "unconfirmed") return "Nije potvrđeno, osveži listu";
  if (result?.outcome === "not-found") return "faktura više nije na SEF-u";
  return result?.message ?? "SEF nije prihvatio fakturu";
};

function Group({ title, action, children }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="mt-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id={id} className="text-[13px] font-bold tracking-wide text-ink-3 uppercase">
          {title}
        </h2>
        {action}
      </div>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

// /e-faktura: incoming invoices from SEF (through api/efaktura.js). Waiting
// ones are accepted many at a time; accepted ones go out together in one mail
// (to the shop for now, to the accountant once there is a mail domain).
export default function Efaktura() {
  const navigate = useNavigate();
  const toast = useToast();
  const sheet = useSheet();
  const acceptDialog = useDialog("accept");
  const sendDialog = useDialog("send");
  const rejectDialog = useDialog("reject");
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "pending";

  const load = useLoad(async () => {
    const status = await efakturaCall("status");
    if (!status.connected) return { status, invoices: null };
    const { invoices } = await efakturaCall("list");
    return { status, invoices };
  }, []);

  const [pendingChoice, setPendingChoice] = useState(() => new Set());
  const [acceptedChoice, setAcceptedChoice] = useState(null); // null: every unsent invoice
  const [asked, setAsked] = useState([]); // the invoices the open accept / send window is about
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);
  useDropStaleSheet(sheet.name === "invoice" && openId === null);

  // A failed reload keeps the list on screen and says why.
  const shownError = useRef(null);
  useEffect(() => {
    if (!load.error || !load.data || shownError.current === load.error) return;
    shownError.current = load.error;
    toast.show({ kind: "error", text: efakturaErrorText(load.error.code) });
  }, [load.error, load.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayIso = belgradeDateOf(new Date().toISOString());
  const status = load.data?.status;
  const invoices = load.data?.invoices ?? [];
  const pendingGroups = groupByDay(tabInvoices(invoices, "pending"), todayIso);
  const pending = pendingGroups.flatMap((group) => group.invoices);
  const accepted = tabInvoices(invoices, "accepted");
  const sendGroups = SEND_GROUPS.map((group) => ({ ...group, invoices: accepted.filter((i) => i.send?.state === group.state).sort(newestFirst) })).filter(
    (group) => group.invoices.length > 0
  );
  const acceptedInOrder = sendGroups.flatMap((group) => group.invoices);
  // Only what is still on its tab counts: an invoice accepted elsewhere drops out.
  const chosenPending = pending.filter((i) => pendingChoice.has(i.id));
  const chosenAccepted = acceptedInOrder.filter((i) => (acceptedChoice ? acceptedChoice.has(i.id) : i.send?.state === "unsent"));
  const openInvoice = invoices.find((i) => i.id === openId) ?? null;

  const setTab = (key) => {
    if (key === "accepted") setAcceptedChoice(null);
    setParams(key === "pending" ? {} : { tab: key }, { replace: true });
  };

  const togglePending = (id) =>
    setPendingChoice((choice) => {
      const next = new Set(choice);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleDay = (ids, all) =>
    setPendingChoice((choice) => {
      const next = new Set(choice);
      for (const id of ids) {
        if (all) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  const toggleAccepted = (id) =>
    setAcceptedChoice(() => {
      const next = new Set(chosenAccepted.map((i) => i.id));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // One request per part, one after another; a refused request stops the
  // rest and keeps what was already done.
  const inParts = async (action, ids, size) => {
    const results = [];
    for (let i = 0; i < ids.length; i += size) {
      try {
        results.push(...(await efakturaCall(action, { invoiceIds: ids.slice(i, i + size) })).results);
      } catch (error) {
        results.push(...(error.body?.results ?? []));
        return { results, error };
      }
    }
    return { results, error: null };
  };

  const askAccept = (list) => {
    setAsked(list);
    acceptDialog.open();
  };

  const accept = async () => {
    const ids = asked.map((i) => i.id);
    setBusy(true);
    toast.show({ kind: "loading", text: "Prihvatam…" });
    const { results, error } = await inParts("accept", ids, ACCEPT_PART);
    // "already" is accepted only when SEF says Approved; rejected or
    // cancelled elsewhere is no longer waiting, but never "accepted"
    const okIds = new Set(results.filter((r) => r.outcome === "done" || (r.outcome === "already" && r.status === "Approved")).map((r) => r.id));
    const elsewhere = results.filter((r) => r.outcome === "already" && r.status !== "Approved");
    const settled = new Set([...okIds, ...elsewhere.map((r) => r.id)]);
    setPendingChoice((choice) => new Set([...choice].filter((id) => !settled.has(id))));
    setAcceptedChoice(null);
    const n = ids.length;
    const failures = results.filter((r) => !settled.has(r.id));
    if (error) {
      toast.show({ kind: "error", text: `${okIds.size > 0 ? `Prihvaćeno ${okIds.size} od ${n}. ` : ""}${efakturaErrorText(error.code)}` });
    } else if (okIds.size === n) {
      toast.show({ kind: "success", text: `${plural(n, "Prihvaćena", "Prihvaćene", "Prihvaćeno")} ${fakture(n)}` });
    } else if (failures.length > 0) {
      const failed = n - okIds.size - elsewhere.length;
      toast.show({ kind: "error", text: `Prihvaćeno ${okIds.size} od ${n}, ${failed} ${plural(failed, "nije", "nisu", "nije")}: ${outcomeText(failures[0])}` });
    } else {
      const only = elsewhere.length === 1 && asked.find((i) => i.id === elsewhere[0].id);
      const why = only
        ? `${invoiceLabel(only)} je već ${statusLabel(elsewhere[0].status).toLowerCase()}.`
        : `${elsewhere.length} ${plural(elsewhere.length, "faktura više nije", "fakture više nisu", "faktura više nije")} na čekanju.`;
      toast.show({ kind: "info", text: `Prihvaćeno ${okIds.size} od ${n}. ${why}` });
    }
    acceptDialog.close();
    setBusy(false);
    load.reload();
  };

  const askSend = () => {
    setAsked(chosenAccepted);
    sendDialog.open();
  };

  const send = async () => {
    const ids = asked.map((i) => i.id);
    setBusy(true);
    toast.show({ kind: "loading", text: "Šaljem…" });
    const { results, error } = await inParts("send", ids, SEND_PART);
    const sent = results.filter((r) => r.outcome === "sent").length;
    const to = status.sendTo;
    const bad = results.filter((r) => r.outcome !== "sent");
    const first = bad[0] && asked.find((i) => i.id === bad[0].id);
    if (sent === ids.length) {
      toast.show({ kind: "success", text: `${plural(sent, "Poslata", "Poslate", "Poslato")} ${fakture(sent)} na ${to}` });
    } else if (sent > 0 && first) {
      const what = bad[0].outcome === "not-sendable" ? "više nije prihvaćena na SEF-u" : "nije poslata, pokušaj ponovo";
      toast.show({ kind: "error", text: `Poslato ${sent} od ${ids.length}. ${invoiceLabel(first)} ${what}${bad.length > 1 ? ` (i još ${bad.length - 1})` : ""}.` });
    } else if (sent > 0) {
      toast.show({ kind: "error", text: `Poslato ${sent} od ${ids.length}. ${efakturaErrorText(error?.code ?? "send-failed")}` });
    } else {
      toast.show({ kind: "error", text: efakturaErrorText(error?.code ?? "send-failed") });
    }
    setAcceptedChoice(null);
    sendDialog.close();
    setBusy(false);
    load.reload();
  };

  const reject = async (comment) => {
    setBusy(true);
    try {
      const [result] = (await efakturaCall("reject", { invoiceId: openInvoice.id, comment })).results;
      if (result.outcome === "done") toast.show({ kind: "success", text: "Faktura odbijena" });
      else if (result.outcome === "already") toast.show({ kind: "info", text: `Faktura je već: ${statusLabel(result.status).toLowerCase()}` });
      else toast.show({ kind: "error", text: `Faktura nije odbijena: ${outcomeText(result)}` });
      rejectDialog.close();
    } catch (error) {
      toast.show({ kind: "error", text: efakturaErrorText(error.code) });
    } finally {
      setBusy(false);
      load.reload();
    }
  };

  const openPdf = async () => {
    const invoice = openInvoice;
    toast.show({ kind: "loading", text: "Preuzimam PDF…" });
    try {
      downloadBlob(await efakturaPdf(invoice.id), pdfFilename(invoice));
      toast.show({ kind: "success", text: "PDF preuzet" });
    } catch (error) {
      toast.show({ kind: "error", text: efakturaErrorText(error.code) });
    }
  };

  const resetMock = async () => {
    try {
      await efakturaCall("reset-mock");
      setPendingChoice(new Set());
      setAcceptedChoice(null);
      toast.show({ kind: "success", text: "Probne fakture su vraćene" });
    } catch (error) {
      toast.show({ kind: "error", text: efakturaErrorText(error.code) });
    }
    load.reload();
  };

  const open = (invoice) => {
    setOpenId(invoice.id);
    sheet.open("invoice");
  };

  const row = (invoice, extra = {}) => <InvoiceRow key={invoice.id} invoice={invoice} todayIso={todayIso} onOpen={() => open(invoice)} {...extra} />;

  const connected = Boolean(status?.connected);
  const title = <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em] text-ink">e-Faktura</h1>;
  const actions = connected && (
    <>
      <IconButton label="Osveži" icon={RefreshCw} onClick={load.reload} />
      <IconButton label="Podešavanja e-Fakture" icon={Settings2} onClick={() => navigate("/e-faktura/podesavanja")} />
    </>
  );

  let body;
  if (!load.data) {
    body = load.error ? <LoadError text={efakturaErrorText(load.error.code)} onRetry={load.reload} /> : <p className="mt-8 text-center text-[15px] text-ink-3">Učitavanje…</p>;
  } else if (!connected) {
    body = (
      <div className="mt-8 flex flex-col items-center gap-3 rounded-card bg-surface-muted px-5 py-6 text-center">
        <p className="text-[17px] font-semibold text-ink">e-Faktura nije povezana.</p>
        <p className="text-[14px] text-ink-2">Unesi API ključ sa SEF-a, naziv radnje i PIB.</p>
        <Button variant="dark" size="md" onClick={() => navigate("/e-faktura/podesavanja")}>
          Poveži e-Fakturu
        </Button>
      </div>
    );
  } else {
    const counts = { pending: pending.length, accepted: accepted.length };
    body = (
      <>
        {status.mode === "mock" && (
          <div className="mt-4 flex flex-col gap-2">
            <MockBanner />
            <Button variant="text" size="md" icon={RotateCcw} onClick={resetMock} className="self-start">
              Vrati probne fakture
            </Button>
          </div>
        )}
        <div role="group" aria-label="Fakture" className="mt-4 flex rounded-full bg-surface-muted p-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
              className={`h-10 flex-1 rounded-full text-[14px] font-semibold ${tab === key ? "bg-ink text-bg" : "text-ink-2"}`}
            >
              {label}
              {key in counts && (
                <>
                  {" "}
                  <span className="font-mono text-[12px] opacity-70">{counts[key]}</span>
                </>
              )}
            </button>
          ))}
        </div>

        {tab === "pending" &&
          pendingGroups.map((group) => {
            const ids = group.invoices.map((i) => i.id);
            const all = ids.every((id) => pendingChoice.has(id));
            return (
              <Group
                key={group.key}
                title={group.title}
                action={
                  <button type="button" onClick={() => toggleDay(ids, all)} className="text-[14px] font-semibold text-accent">
                    {all ? "Poništi izbor" : "Izaberi sve"}
                  </button>
                }
              >
                {group.invoices.map((invoice) => row(invoice, { selectable: true, selected: pendingChoice.has(invoice.id), onToggle: () => togglePending(invoice.id) }))}
              </Group>
            );
          })}

        {tab === "accepted" &&
          sendGroups.map((group) => (
            <Group key={group.state} title={group.title}>
              {group.invoices.map((invoice) =>
                row(invoice, { selectable: true, selected: chosenAccepted.some((i) => i.id === invoice.id), onToggle: () => toggleAccepted(invoice.id), showSent: true })
              )}
            </Group>
          ))}

        {tab === "all" &&
          groupByDay(invoices, todayIso).map((group) => (
            <Group key={group.key} title={group.title}>
              {group.invoices.map((invoice) => row(invoice, { showStatus: true }))}
            </Group>
          ))}

        {(tab === "pending" ? pending : tab === "accepted" ? accepted : invoices).length === 0 && <p className="mt-10 text-center text-[15px] text-ink-3">{EMPTY[tab]}</p>}
      </>
    );
  }

  const bar =
    connected && tab === "pending" && chosenPending.length > 0 ? (
      <>
        {!status.acceptEnabled && <p className="pointer-events-auto mb-2 text-center text-[13px] font-semibold text-ink-3">Prihvatanje još nije uključeno</p>}
        <Button disabled={!status.acceptEnabled || busy} onClick={() => askAccept(chosenPending)} className="pointer-events-auto w-full">
          {`Prihvati (${chosenPending.length}) · ukupno ${formatAmount(invoicesTotal(chosenPending), "RSD")}`}
        </Button>
      </>
    ) : connected && tab === "accepted" && chosenAccepted.length > 0 ? (
      <Button disabled={busy} onClick={askSend} className="pointer-events-auto w-full">
        {`Pošalji (${chosenAccepted.length})`}
      </Button>
    ) : null;

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(140px+env(safe-area-inset-bottom))]">
      <AppHeader title={title} actions={actions} />
      {body}

      {bar && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto w-full max-w-[480px] bg-linear-to-b from-bg/0 to-bg to-40% px-5 pt-8 pb-[calc(24px+env(safe-area-inset-bottom))]">{bar}</div>
        </div>
      )}

      <InvoiceSheet
        open={sheet.name === "invoice" && openInvoice !== null}
        onClose={sheet.close}
        invoice={openInvoice}
        todayIso={todayIso}
        acceptEnabled={Boolean(status?.acceptEnabled)}
        busy={busy}
        onAccept={() => askAccept([openInvoice])}
        onReject={rejectDialog.open}
        onPdf={openPdf}
      />
      <ConfirmDialog
        open={acceptDialog.isOpen && asked.length > 0}
        title={`Prihvatiti ${fakturu(asked.length)}?`}
        text={`Ukupno ${formatAmount(invoicesTotal(asked), "RSD")}. Prihvatanje odmah ide u SEF.`}
        confirmLabel="Prihvati"
        busy={busy}
        onConfirm={accept}
        onClose={acceptDialog.close}
      />
      <ConfirmDialog
        open={sendDialog.isOpen && asked.length > 0}
        title={`Poslati ${fakturu(asked.length)} na ${status?.sendTo ?? ""}?`}
        text="Svaka faktura ide kao poseban PDF u jednom mejlu."
        confirmLabel="Pošalji"
        busy={busy}
        onConfirm={send}
        onClose={sendDialog.close}
      />
      <RejectDialog open={rejectDialog.isOpen && openInvoice !== null} busy={busy} onConfirm={reject} onClose={rejectDialog.close} />
    </div>
  );
}
