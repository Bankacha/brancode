-- Promo leaflets ("liflet"): the period of every imported leaflet and, for each
-- article already in `products`, its promo price and the regular price it replaced,
-- so the regular prices go back by themselves after the promotion ends.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- The app writes here on import; the daily morning check (Vercel Cron) uses the
-- service-role key, which bypasses RLS.

create table public.promo_leaflets (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (length(trim(name)) > 0),  -- "Jutro Liflet Avg", or the file name
  date_from             date not null,
  date_to               date not null,
  imported_at           timestamptz not null default now(),
  imported_by           uuid default auth.uid() references auth.users (id) on delete set null,
  prices_applied_at     timestamptz,  -- promo prices written to `products` (at import, or by the morning check on date_from)
  prices_restored_at    timestamptz,  -- regular prices written back after date_to
  reminded_tomorrow_at  timestamptz,  -- "Akcija ističe sutra" sent
  reminded_today_at     timestamptz,  -- "Akcija ističe danas" sent
  constraint promo_leaflets_period check (date_to >= date_from),
  constraint promo_leaflets_unique unique (name, date_from, date_to)  -- importing the same leaflet again updates it
);

create table public.promo_leaflet_items (
  leaflet_id      uuid not null references public.promo_leaflets (id) on delete cascade,
  barcode         text not null,  -- the `products` row the promo price goes to, as stored there
  name            text not null,
  promo_price     numeric(12, 2) not null check (promo_price > 0),
  regular_price   numeric(12, 2),  -- price before this leaflet, or carried over from an earlier one still running; null if none
  restore_result  text check (restore_result in ('restored', 'changed', 'newer_leaflet')),  -- 'changed': edited by hand meanwhile, left alone
  primary key (leaflet_id, barcode)
);

create index promo_leaflet_items_barcode_idx on public.promo_leaflet_items (barcode);
create index promo_leaflets_period_idx on public.promo_leaflets (date_to, date_from);

-- --------------------------------------------------------------- access
-- Signed-in users import leaflets and read them (the Liflet mark on a trebovanje);
-- anonymous visitors see nothing.

alter table public.promo_leaflets      enable row level security;
alter table public.promo_leaflet_items enable row level security;

create policy "Signed-in users manage promo leaflets" on public.promo_leaflets
  for all to authenticated using (true) with check (true);
create policy "Signed-in users manage promo leaflet items" on public.promo_leaflet_items
  for all to authenticated using (true) with check (true);
