create table if not exists public.user_entities (
    id varchar(1000) primary key,
    name varchar(100) not null unique,
    display_name varchar(200)
);

create table if not exists public.user_credentials (
    credential_id varchar(1000) primary key,
    user_entity_user_id varchar(1000) not null references public.user_entities(id) on delete cascade,
    public_key bytea not null,
    signature_count bigint,
    uv_initialized boolean,
    backup_eligible boolean not null,
    authenticator_transports varchar(1000),
    public_key_credential_type varchar(100),
    backup_state boolean not null,
    attestation_object bytea,
    attestation_client_data_json bytea,
    created timestamp with time zone,
    last_used timestamp with time zone,
    label varchar(1000) not null
);

create index if not exists idx_user_credentials_user_id
    on public.user_credentials(user_entity_user_id);

comment on table public.user_credentials is
    'WebAuthn public credentials only. Biometric data and private keys are never stored.';

comment on column public.user_credentials.public_key is
    'COSE public key stored as bytea; never use PostgreSQL Large Object storage.';
