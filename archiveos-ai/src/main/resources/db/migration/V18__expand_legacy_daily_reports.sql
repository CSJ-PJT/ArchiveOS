-- Keep legacy daily report rows intact while bringing their schema up to the
-- read/write contract used by OperationsRepository.
alter table if exists public.daily_reports
  add column if not exists runtime_summary jsonb not null default '{}'::jsonb,
  add column if not exists latest_builder jsonb,
  add column if not exists latest_reviewer jsonb,
  add column if not exists operator_summary jsonb not null default '{}'::jsonb,
  add column if not exists warnings jsonb not null default '[]'::jsonb,
  add column if not exists decisions_count integer not null default 0,
  add column if not exists commands_count integer not null default 0,
  add column if not exists discord_sent boolean not null default false,
  add column if not exists discord_skipped_reason text,
  add column if not exists slack_sent boolean not null default false,
  add column if not exists slack_skipped_reason text,
  add column if not exists notification_results jsonb not null default '[]'::jsonb;
