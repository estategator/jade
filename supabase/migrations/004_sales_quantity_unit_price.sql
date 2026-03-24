-- ============================================================
-- Migration 004: Add quantity and unit_price to sales table
-- Records per-unit pricing and quantity sold per transaction.
-- ============================================================

alter table sales
  add column if not exists quantity   integer not null default 1,
  add column if not exists unit_price numeric(12,2);

-- Backfill unit_price for existing completed sales from the linked inventory item
update sales
  set unit_price = inventory_items.price
  from inventory_items
  where sales.inventory_item_id = inventory_items.id
    and sales.unit_price is null;

-- For any remaining rows where the item was deleted, derive from amount / quantity
update sales
  set unit_price = amount / quantity
  where unit_price is null;

-- Now make it non-null with a default
alter table sales
  alter column unit_price set not null,
  alter column unit_price set default 0;
