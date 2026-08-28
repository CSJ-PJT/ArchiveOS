create table if not exists public.atlas_access_daily_reports (
    target_date date primary key,
    generated_at timestamptz not null,
    delivered_at timestamptz,
    monitored_requests bigint not null check (monitored_requests >= 0),
    monitored_unique_connections bigint not null check (monitored_unique_connections >= 0),
    status_2xx bigint not null check (status_2xx >= 0),
    status_3xx bigint not null check (status_3xx >= 0),
    status_4xx bigint not null check (status_4xx >= 0),
    status_5xx bigint not null check (status_5xx >= 0),
    imported_at timestamptz not null default now()
);

create table if not exists public.atlas_access_daily_services (
    target_date date not null references public.atlas_access_daily_reports(target_date) on delete cascade,
    service_name text not null,
    request_count bigint not null check (request_count >= 0),
    primary key (target_date, service_name)
);

create index if not exists atlas_access_daily_reports_generated_idx
    on public.atlas_access_daily_reports(generated_at desc);

create index if not exists atlas_access_daily_services_date_idx
    on public.atlas_access_daily_services(target_date desc, request_count desc);

comment on table public.atlas_access_daily_reports is
    'Aggregate-only Atlas OCI access reports. Raw IPs, digests, aliases, and identity details are prohibited.';
