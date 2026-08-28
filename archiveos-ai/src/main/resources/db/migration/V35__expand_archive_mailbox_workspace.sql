alter table public.archive_mail_message
  add column if not exists is_starred boolean not null default false;

create index if not exists archive_mail_message_starred_time_idx
  on public.archive_mail_message(mailbox, occurred_at desc)
  where deleted_at is null and is_starred = true;

create index if not exists archive_mail_message_trash_time_idx
  on public.archive_mail_message(mailbox, deleted_at desc)
  where deleted_at is not null;
