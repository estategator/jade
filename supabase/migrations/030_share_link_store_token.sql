-- Store the raw share token so the portal URL can be displayed persistently.
-- The token_hash column remains for O(1) lookups when a client visits the link.
alter table project_share_links
  add column if not exists token text;
