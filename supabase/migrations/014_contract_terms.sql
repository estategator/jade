-- =========================
-- Contract financial terms & editable draft support
-- =========================

-- Commission & fee columns
alter table contracts
  add column if not exists commission_rate       numeric(5,2),
  add column if not exists minimum_commission    numeric(10,2),
  add column if not exists flat_fee              numeric(10,2) default 0,
  add column if not exists additional_charges    jsonb not null default '[]'::jsonb,
  add column if not exists sale_duration_days    integer,
  add column if not exists discount_schedule     jsonb not null default '[]'::jsonb,
  add column if not exists unsold_items_handling text default 'client_keeps',
  add column if not exists payment_terms_days    integer default 14,
  add column if not exists cancellation_fee      numeric(10,2) default 0,
  add column if not exists special_terms         text not null default '';

-- Constraint for unsold items handling
-- (using DO block because ADD CONSTRAINT IF NOT EXISTS isn't available)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contracts_unsold_items_handling_check'
  ) then
    alter table contracts
      add constraint contracts_unsold_items_handling_check
        check (unsold_items_handling in ('client_keeps', 'donate', 'haul_away', 'negotiate'));
  end if;
end;
$$;

comment on column contracts.commission_rate       is 'Percentage of gross sales (e.g., 35.00 = 35%)';
comment on column contracts.minimum_commission    is 'Guaranteed minimum commission in dollars';
comment on column contracts.flat_fee              is 'One-time flat service fee in dollars';
comment on column contracts.additional_charges    is 'JSON array: [{label: string, amount: number}]';
comment on column contracts.sale_duration_days    is 'Planned number of sale days';
comment on column contracts.discount_schedule     is 'JSON array: [{day: number, percent: number}]';
comment on column contracts.unsold_items_handling is 'What happens to unsold items after the sale';
comment on column contracts.payment_terms_days    is 'Days after sale end to pay client proceeds';
comment on column contracts.cancellation_fee      is 'Cancellation penalty in dollars';
comment on column contracts.special_terms         is 'Free-text additional terms or notes';
