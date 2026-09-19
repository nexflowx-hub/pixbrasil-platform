-- Client Portal account memberships.
-- Keeps all core tables backend-only while enabling multi-account and multi-user access.

create table if not exists public.account_memberships (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role varchar(24) not null
    check (role in ('OWNER','ADMIN','FINANCE','VIEWER')),
  status varchar(16) not null default 'ACTIVE'
    check (status in ('ACTIVE','INVITED','SUSPENDED','REVOKED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id,user_id)
);

create index if not exists account_memberships_user_status_idx
  on public.account_memberships(user_id,status,account_id);

create index if not exists account_memberships_account_status_idx
  on public.account_memberships(account_id,status,user_id);

alter table public.account_memberships enable row level security;
revoke all on public.account_memberships from anon, authenticated;

insert into public.account_memberships(account_id,user_id,role,status,metadata)
select a.id,a.user_id,'OWNER','ACTIVE','{"source":"ACCOUNT_OWNER_BACKFILL"}'::jsonb
from public.accounts a
on conflict (account_id,user_id) do update
set status='ACTIVE',
    role=case
      when public.account_memberships.role='OWNER' then 'OWNER'
      else public.account_memberships.role
    end,
    updated_at=now();

comment on table public.account_memberships is
  'Account-level access for Personal and Business client portal users. Business accounts support multiple members and roles.';
