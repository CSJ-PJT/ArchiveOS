alter table public.archiveos_admin_credential
    add column if not exists role text not null default 'ADMIN',
    add column if not exists enabled boolean not null default true;

alter table public.archiveos_admin_credential
    drop constraint if exists archiveos_admin_credential_role_check;

alter table public.archiveos_admin_credential
    add constraint archiveos_admin_credential_role_check
    check (role in ('OPERATOR', 'PM', 'ADMIN'));
