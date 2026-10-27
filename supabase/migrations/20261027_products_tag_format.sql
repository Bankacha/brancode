-- Mix printing: each article's remembered price-tag format, set when the shop
-- prints from Mix ('shelf' = raf, 'fridge' = friz); null = not remembered yet.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Saving a price and importing a leaflet write only barcode, name and price,
-- so they leave this column as it is.

alter table public.products
  add column tag_format text check (tag_format in ('shelf', 'fridge'));
