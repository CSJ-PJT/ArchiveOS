alter table public.archive_mail_message
  add column if not exists deleted_at timestamptz;

create index if not exists archive_mail_message_active_mailbox_time_idx
  on public.archive_mail_message(mailbox, occurred_at desc)
  where deleted_at is null;
