create table if not exists archiveos_admin_credential (
    credential_key text primary key,
    password_hash text not null,
    updated_at timestamptz not null default now(),
    updated_by text not null default 'bootstrap'
);
