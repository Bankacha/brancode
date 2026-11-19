-- e-Faktura (SEF): the shop's sealed SEF API key and the history of what the
-- app accepted, rejected and sent (spec docs/superpowers/specs/2026-11-17-brancode-e-faktura-design.md).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Only the server function api/efaktura.js reads and writes these tables, with
-- the service-role key (which bypasses RLS). No app user and no visitor can
-- read them: RLS is on with no policies, and anon/authenticated have no grants.

-- ------------------------------------------------------------- settings
-- One row per mode, so a test on a preview deploy (same database) can never
-- overwrite or remove the real key. Later, with several shops, the key grows a
-- shop column.

create table public.efaktura_settings (
  mode            text primary key check (mode in ('mock', 'demo', 'production')),
  key_ciphertext  text,  -- the SEF API key sealed with AES-256-GCM under EFAKTURA_SECRET (Vercel)
  key_iv          text,
  key_tag         text,
  key_last4       text,  -- all the app ever shows of the key
  shop_name       text,
  pib             text check (pib ~ '^[0-9]{9}$'),
  send_to         text,  -- null: the shop's own address (EMAIL_TO); another address waits for a mail domain
  connected_at    timestamptz,  -- first key saved in this mode; a replaced key keeps it
  baseline_ids    bigint[] not null default '{}',  -- invoices already accepted at connection: printed and carried then, never offered for sending
  updated_by      text,
  updated_at      timestamptz not null default now()
);

-- --------------------------------------------------------------- history
-- One row per action on an invoice, with the invoice as it was (due date
-- included, for a later "označi kao plaćeno"). Rows are only ever added.

create table public.efaktura_events (
  id                  bigint generated always as identity primary key,
  mode                text not null check (mode in ('mock', 'demo', 'production')),
  invoice_id          bigint not null,  -- SEF's invoiceId
  action              text not null check (action in ('accepted', 'rejected', 'sent')),
  comment             text,  -- the reason given when rejecting
  recipient           text,  -- where it was sent
  user_id             uuid,
  user_email          text,
  created_at          timestamptz not null default now(),
  supplier            text,
  supplier_pib        text,
  invoice_number      text,
  received_at         timestamptz,
  due_date            date,
  amount              numeric(14, 2),
  amount_without_vat  numeric(14, 2),
  vat                 numeric(14, 2),
  currency            text,
  sef_status          text  -- the invoice's SEF status when this happened
);

create index efaktura_events_mode_created_idx on public.efaktura_events (mode, created_at);
create index efaktura_events_invoice_idx on public.efaktura_events (invoice_id);

-- Nothing in the history can be changed or removed, even by a bug in the app;
-- only the test rows go when "Vrati probne fakture" clears them.
create function public.efaktura_events_append_only() returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.mode = 'mock' then
    return old;
  end if;
  raise exception 'efaktura_events is append-only';
end;
$$;

create trigger efaktura_events_append_only
  before update or delete on public.efaktura_events
  for each row execute function public.efaktura_events_append_only();

-- --------------------------------------------------------------- access

alter table public.efaktura_settings enable row level security;
alter table public.efaktura_events   enable row level security;

revoke all on table public.efaktura_settings from anon, authenticated;
revoke all on table public.efaktura_events   from anon, authenticated;
revoke all on sequence public.efaktura_events_id_seq from anon, authenticated;
revoke all on function public.efaktura_events_append_only() from anon, authenticated, public;
