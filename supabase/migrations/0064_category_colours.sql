-- Category colour coding for the diary (customer request).
-- Nullable, no default: existing categories render exactly as today until a
-- tech picks a colour. Values are palette ids (e.g. 'teal'), never raw hex —
-- the palette lives in lib/category-colours.ts.

alter table public.categories
  add column if not exists colour text;

comment on column public.categories.colour is
  'Palette id from lib/category-colours.ts (e.g. teal). Null = no colour, diary renders as before.';
