create table if not exists archiveos_atlas_sso_grant (
    credential_key text not null references archiveos_admin_credential(credential_key) on delete cascade,
    app_key text not null,
    enabled boolean not null default true,
    granted_by text not null,
    granted_at timestamptz not null default now(),
    primary key (credential_key, app_key),
    check (app_key in ('management', 'travel', 'learn', 'health', 'jobs', 'sketchfy', 'backend'))
);

create table if not exists archiveos_sso_authorization_code (
    id bigserial primary key,
    code_hash char(64) not null unique,
    credential_key text not null references archiveos_admin_credential(credential_key) on delete cascade,
    platform_role text not null,
    client_id text not null,
    redirect_uri text not null,
    code_challenge text not null,
    requested_app text not null,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null default now(),
    check (platform_role in ('OPERATOR', 'PM', 'ADMIN')),
    check (client_id = 'atlas'),
    check (requested_app in ('portal', 'management', 'travel', 'learn', 'health', 'jobs', 'sketchfy', 'backend'))
);

create index if not exists archiveos_sso_authorization_code_expiry_idx
    on archiveos_sso_authorization_code (expires_at)
    where used_at is null;

comment on table archiveos_atlas_sso_grant is
    'One-way ArchiveOS-to-Atlas application grants. Atlas identities never create ArchiveOS sessions.';

comment on table archiveos_sso_authorization_code is
    'Short-lived, single-use PKCE authorization codes. Only SHA-256 code hashes are stored.';
