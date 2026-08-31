alter table public.atlas_access_daily_services
  add column if not exists status_2xx bigint not null default 0 check (status_2xx >= 0),
  add column if not exists status_3xx bigint not null default 0 check (status_3xx >= 0),
  add column if not exists status_4xx bigint not null default 0 check (status_4xx >= 0),
  add column if not exists status_5xx bigint not null default 0 check (status_5xx >= 0);

comment on column public.atlas_access_daily_services.status_4xx is
  'Expected access denials and missing routes for this project; not a service outage count.';

comment on column public.atlas_access_daily_services.status_5xx is
  'Server-side failures for this project.';

create table if not exists public.atlas_access_daily_source_reports (
  target_date date not null,
  report_source text not null,
  generated_at timestamptz not null,
  delivered_at timestamptz,
  monitored_requests bigint not null check (monitored_requests >= 0),
  monitored_unique_connections bigint not null check (monitored_unique_connections >= 0),
  status_2xx bigint not null check (status_2xx >= 0),
  status_3xx bigint not null check (status_3xx >= 0),
  status_4xx bigint not null check (status_4xx >= 0),
  status_5xx bigint not null check (status_5xx >= 0),
  imported_at timestamptz not null default now(),
  primary key (target_date, report_source)
);

create table if not exists public.atlas_access_daily_source_services (
  target_date date not null,
  report_source text not null,
  service_name text not null,
  request_count bigint not null check (request_count >= 0),
  status_2xx bigint not null check (status_2xx >= 0),
  status_3xx bigint not null check (status_3xx >= 0),
  status_4xx bigint not null check (status_4xx >= 0),
  status_5xx bigint not null check (status_5xx >= 0),
  primary key (target_date, report_source, service_name),
  foreign key (target_date, report_source)
    references public.atlas_access_daily_source_reports(target_date, report_source)
    on delete cascade
);

insert into public.atlas_access_daily_source_reports(
    target_date, report_source, generated_at, delivered_at, monitored_requests,
    monitored_unique_connections, status_2xx, status_3xx, status_4xx, status_5xx, imported_at)
select target_date, 'legacy', generated_at, delivered_at, monitored_requests,
       monitored_unique_connections, status_2xx, status_3xx, status_4xx, status_5xx, imported_at
  from public.atlas_access_daily_reports
on conflict do nothing;

insert into public.atlas_access_daily_source_services(
    target_date, report_source, service_name, request_count,
    status_2xx, status_3xx, status_4xx, status_5xx)
select target_date, 'legacy', service_name, request_count,
       status_2xx, status_3xx, status_4xx, status_5xx
  from public.atlas_access_daily_services
on conflict do nothing;

comment on table public.atlas_access_daily_source_reports is
  'Per-edge aggregate-only access reports used to build the combined Atlas and Archive view.';
