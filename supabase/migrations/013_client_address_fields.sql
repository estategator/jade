-- =========================
-- Address columns on client_profiles
-- =========================
alter table client_profiles
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip_code text;
