-- ============================================================
-- Migration 003: Invoices module
-- Adds invoices + invoice_lines tables for generating invoices
-- from sales/inventory data with org/project/date-range filters.
-- ============================================================

-- =========================
-- 1. Invoices (header)
-- =========================
create table if not exists invoices (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations (id) on delete cascade,
  project_id      uuid references projects (id) on delete set null,
  invoice_number  text not null,
  status          text not null default 'draft'
                    check (status in ('draft', 'finalized', 'void')),
  period_start    date not null,
  period_end      date not null,
  subtotal        numeric(12,2) not null default 0,
  tax_amount      numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  line_count      integer not null default 0,
  notes           text not null default '',
  filters_used    jsonb not null default '{}'::jsonb,
  created_by      uuid not null references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint invoices_period_valid check (period_start <= period_end),
  unique (org_id, invoice_number)
);

create index if not exists idx_invoices_org_created
  on invoices (org_id, created_at desc);

create index if not exists idx_invoices_org_status
  on invoices (org_id, status);

create index if not exists idx_invoices_project
  on invoices (project_id)
  where project_id is not null;

-- =========================
-- 2. Invoice lines (snapshot from inventory_items at generation time)
-- =========================
create table if not exists invoice_lines (
  id                uuid primary key default gen_random_uuid(),
  invoice_id        uuid not null references invoices (id) on delete cascade,
  inventory_item_id uuid references inventory_items (id) on delete set null,
  item_name         text not null,
  item_category     text not null default 'Uncategorized',
  item_description  text not null default '',
  quantity          integer not null default 1,
  unit_price        numeric(12,2) not null default 0,
  line_total        numeric(12,2) not null default 0,
  sold_at           timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_invoice_lines_invoice
  on invoice_lines (invoice_id);

create index if not exists idx_invoice_lines_item
  on invoice_lines (inventory_item_id)
  where inventory_item_id is not null;

-- =========================
-- 3. Row-Level Security
-- =========================

-- ---- invoices ----
alter table invoices enable row level security;

create policy "Org members can view invoices"
  on invoices for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = invoices.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Org members can create invoices"
  on invoices for insert
  to authenticated
  with check (
    exists (
      select 1 from org_members
      where org_members.org_id = invoices.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Admins can update invoices"
  on invoices for update
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = invoices.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

create policy "Admins can delete invoices"
  on invoices for delete
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = invoices.org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );

-- ---- invoice_lines ----
alter table invoice_lines enable row level security;

create policy "Org members can view invoice lines"
  on invoice_lines for select
  to authenticated
  using (
    exists (
      select 1 from invoices
      join org_members on org_members.org_id = invoices.org_id
      where invoices.id = invoice_lines.invoice_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Org members can insert invoice lines"
  on invoice_lines for insert
  to authenticated
  with check (
    exists (
      select 1 from invoices
      join org_members on org_members.org_id = invoices.org_id
      where invoices.id = invoice_lines.invoice_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Admins can delete invoice lines"
  on invoice_lines for delete
  to authenticated
  using (
    exists (
      select 1 from invoices
      join org_members on org_members.org_id = invoices.org_id
      where invoices.id = invoice_lines.invoice_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('superadmin', 'admin')
    )
  );
