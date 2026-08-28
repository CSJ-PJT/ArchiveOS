alter table public.archive_mail_message
  add column if not exists forward_status text,
  add column if not exists forward_provider_message_id text,
  add column if not exists forwarded_at timestamptz,
  add column if not exists forward_error text;

-- Forwarding starts from this deployment. Existing inbox history is preserved
-- without sending a surprise backlog to the external forwarding address.
update public.archive_mail_message
   set forward_status = 'skipped_existing'
 where direction = 'inbound'
   and forward_status is null;

create index if not exists archive_mail_message_forward_status_idx
  on public.archive_mail_message(forward_status, occurred_at desc)
  where direction = 'inbound';
