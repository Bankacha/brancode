-- Popis (stocktaking) and Trebovanje (requisition) lists.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Lists are shared by everyone signed in to the shop; nothing here touches `products`.

-- ---------------------------------------------------------------- popis

create table public.inventories (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',                 -- optional text the user adds to the name
  date_from   date not null,
  date_to     date not null,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  constraint inventories_period check (date_to >= date_from)
);

create table public.inventory_items (
  id            uuid primary key default gen_random_uuid(),
  inventory_id  uuid not null references public.inventories (id) on delete cascade,
  barcode       text not null,
  name          text not null check (length(trim(name)) > 0),
  price         numeric(12, 2) not null check (price > 0),
  quantity      numeric(12, 3) not null default 0 check (quantity >= 0),  -- counted on the shelf; decimals for goods by weight
  in_products   boolean not null default false,                         -- found in `products` when added
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint inventory_items_unique_barcode unique (inventory_id, barcode)
);

-- ----------------------------------------------------------- trebovanje

create table public.requisitions (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  date        date not null default current_date,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null
);

create table public.requisition_items (
  id              uuid primary key default gen_random_uuid(),
  requisition_id  uuid not null references public.requisitions (id) on delete cascade,
  barcode         text,                                                  -- optional: "hleb za sendviče" has none
  name            text not null check (length(trim(name)) > 0),
  price           numeric(12, 2) check (price is null or price > 0),
  quantity        numeric(12, 3) check (quantity is null or quantity > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint requisition_items_unique_barcode unique (requisition_id, barcode)  -- several NULL barcodes are allowed
);

create index requisitions_date_idx on public.requisitions (date desc);
create index inventories_created_idx on public.inventories (created_at desc);

-- ------------------------------------------------------------ updated_at

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger inventory_items_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();
create trigger requisition_items_updated_at before update on public.requisition_items
  for each row execute function public.set_updated_at();

-- ------------------------------------------- adding to a quantity safely
-- Two phones counting the same list: add in the database instead of
-- overwriting with a value read earlier. Runs with the caller's rights (RLS applies).

create or replace function public.add_inventory_quantity(item_id uuid, amount numeric)
returns public.inventory_items
language sql security invoker as $$
  update public.inventory_items
     set quantity = quantity + amount
   where id = item_id
  returning *;
$$;

create or replace function public.add_requisition_quantity(item_id uuid, amount numeric)
returns public.requisition_items
language sql security invoker as $$
  update public.requisition_items
     set quantity = coalesce(quantity, 0) + amount
   where id = item_id
  returning *;
$$;

grant execute on function public.add_inventory_quantity(uuid, numeric) to authenticated;
grant execute on function public.add_requisition_quantity(uuid, numeric) to authenticated;

-- --------------------------------------------------------------- access
-- Signed-in users can read and change all lists; anonymous visitors see nothing.

alter table public.inventories       enable row level security;
alter table public.inventory_items   enable row level security;
alter table public.requisitions      enable row level security;
alter table public.requisition_items enable row level security;

create policy "Signed-in users manage inventories" on public.inventories
  for all to authenticated using (true) with check (true);
create policy "Signed-in users manage inventory items" on public.inventory_items
  for all to authenticated using (true) with check (true);
create policy "Signed-in users manage requisitions" on public.requisitions
  for all to authenticated using (true) with check (true);
create policy "Signed-in users manage requisition items" on public.requisition_items
  for all to authenticated using (true) with check (true);
