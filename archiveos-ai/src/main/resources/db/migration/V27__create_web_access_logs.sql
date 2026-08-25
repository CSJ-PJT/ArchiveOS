create table if not exists public.web_access_logs (
    id bigserial primary key,
    occurred_at timestamptz not null default now(),
    actor varchar(80) not null default 'anonymous',
    role varchar(40) not null default 'PUBLIC',
    event_type varchar(40) not null default 'PAGE_VIEW',
    route varchar(40) not null,
    request_path varchar(256) not null,
    client_ip varchar(64) not null default 'unknown',
    user_agent varchar(512),
    referer varchar(512)
);

create index if not exists web_access_logs_occurred_at_idx
    on public.web_access_logs (occurred_at desc);

create index if not exists web_access_logs_route_idx
    on public.web_access_logs (route, occurred_at desc);

create index if not exists web_access_logs_ip_idx
    on public.web_access_logs (client_ip, occurred_at desc);

create index if not exists web_access_logs_actor_idx
    on public.web_access_logs (actor, occurred_at desc);

comment on table public.web_access_logs is
    'ArchiveOS UI route access telemetry. Stores actor, role, client IP, target route and timestamp; never stores cookies, tokens or request bodies.';
