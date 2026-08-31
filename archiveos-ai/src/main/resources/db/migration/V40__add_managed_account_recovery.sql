alter table public.archiveos_admin_credential
    add column if not exists email text,
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists last_login_at timestamptz;

create unique index if not exists archiveos_admin_credential_email_uq
    on public.archiveos_admin_credential (lower(email))
    where email is not null;

create table if not exists public.archiveos_password_reset_token (
    id uuid primary key,
    credential_key text not null references public.archiveos_admin_credential(credential_key) on delete cascade,
    token_hash char(64) not null unique,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    used_at timestamptz,
    constraint archiveos_password_reset_token_expiry_check check (expires_at > created_at)
);

create index if not exists archiveos_password_reset_token_active_idx
    on public.archiveos_password_reset_token (token_hash, expires_at)
    where used_at is null;

comment on column public.archiveos_admin_credential.email is
    'Recovery email maintained only by an authenticated ArchiveOS administrator.';
comment on table public.archiveos_password_reset_token is
    'Single-use password recovery tokens. Only SHA-256 token hashes are stored.';
