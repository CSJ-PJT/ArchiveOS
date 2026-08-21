create table if not exists public.archive_mail_message (
  id uuid primary key,
  provider_message_id text not null unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  mailbox text not null,
  from_address text not null,
  to_addresses jsonb not null default '[]'::jsonb,
  cc_addresses jsonb not null default '[]'::jsonb,
  reply_to_addresses jsonb not null default '[]'::jsonb,
  subject text not null,
  text_body text,
  html_body text,
  headers jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  delivery_status text not null,
  is_read boolean not null default false,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists archive_mail_message_mailbox_time_idx
  on public.archive_mail_message(mailbox, occurred_at desc);

create index if not exists archive_mail_message_direction_time_idx
  on public.archive_mail_message(direction, occurred_at desc);

create table if not exists public.archive_mail_webhook_receipt (
  svix_id text primary key,
  event_type text not null,
  provider_message_id text,
  payload_sha256 text not null,
  received_at timestamptz not null default now()
);
