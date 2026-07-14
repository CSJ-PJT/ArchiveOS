alter table if exists public.daily_reports
  add column if not exists slack_sent boolean not null default false,
  add column if not exists slack_skipped_reason text;

do $$
begin
  if to_regclass('public.daily_reports') is not null then
    update public.daily_reports
    set slack_sent = discord_sent,
        slack_skipped_reason = discord_skipped_reason
    where discord_sent = true
      and slack_sent = false;
  end if;
end $$;
