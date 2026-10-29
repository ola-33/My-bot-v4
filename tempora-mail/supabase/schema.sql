-- Run in Supabase SQL Editor. Service-role credentials stay server-side.
create extension if not exists pgcrypto;
create table if not exists public.temp_inboxes (
  id uuid primary key default gen_random_uuid(),
  email_address text not null unique,
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  deleted_at timestamptz
);
create index if not exists temp_inboxes_active_address_idx on public.temp_inboxes (lower(email_address)) where deleted_at is null;
create index if not exists temp_inboxes_expiry_idx on public.temp_inboxes (expires_at);
create table if not exists public.temp_messages (
  id uuid primary key default gen_random_uuid(),
  inbox_id uuid not null references public.temp_inboxes(id) on delete cascade,
  provider_email_id text not null unique,
  sender text not null default '',
  subject text not null default '(no subject)',
  text_body text not null default '',
  html_body text not null default '',
  received_at timestamptz not null default now()
);
create index if not exists temp_messages_inbox_received_idx on public.temp_messages (inbox_id, received_at desc);
alter table public.temp_inboxes enable row level security;
alter table public.temp_messages enable row level security;
revoke all on public.temp_inboxes from anon, authenticated;
revoke all on public.temp_messages from anon, authenticated;
