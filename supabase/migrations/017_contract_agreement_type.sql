-- =========================
-- Add agreement_type to contracts
-- =========================

-- Add column (nullable first for backfill, then set NOT NULL)
alter table contracts
  add column if not exists agreement_type text;

-- Backfill existing rows as 'estate_sale'
update contracts set agreement_type = 'estate_sale' where agreement_type is null;

-- Now enforce NOT NULL + default
alter table contracts
  alter column agreement_type set not null,
  alter column agreement_type set default 'estate_sale';

-- Constraint for allowed values
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contracts_agreement_type_check'
  ) then
    alter table contracts
      add constraint contracts_agreement_type_check
        check (agreement_type in ('estate_sale', 'buyout'));
  end if;
end;
$$;

comment on column contracts.agreement_type is 'Type of agreement: estate_sale or buyout';
