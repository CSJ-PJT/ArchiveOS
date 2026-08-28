create table if not exists public.atlas_access_events (
    id uuid primary key,
    source_event_id text not null unique,
    occurred_at timestamptz not null,
    actor text not null default 'external-visitor',
    role text not null default 'PUBLIC',
    project_name text not null,
    route text not null,
    action text not null default 'PAGE_VIEW',
    client_ip inet not null,
    user_agent text,
    authenticated boolean not null default false,
    http_status smallint not null check (http_status between 100 and 599),
    imported_at timestamptz not null default now()
);

create index if not exists atlas_access_events_occurred_idx
    on public.atlas_access_events(occurred_at desc);

create index if not exists atlas_access_events_project_idx
    on public.atlas_access_events(project_name, occurred_at desc);

create index if not exists atlas_access_events_client_ip_idx
    on public.atlas_access_events(client_ip, occurred_at desc);

comment on table public.atlas_access_events is
    'Admin-only human page access history imported from the OCI edge. Static assets and automated probes are excluded before import.';
