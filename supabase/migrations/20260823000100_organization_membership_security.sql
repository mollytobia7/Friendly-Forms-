-- Friendly Forms security foundation.
-- This migration intentionally contains only organizations and memberships.
-- RLS is defense in depth; API authorization remains mandatory.

create schema if not exists private;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_status_check
    check (status in ('active', 'suspended', 'deletion_requested', 'deleting', 'deleted')),
  constraint organizations_slug_check
    check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$')
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null,
  status text not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_memberships_organization_fk
    foreign key (organization_id)
    references public.organizations(id)
    on delete restrict,
  constraint organization_memberships_role_check
    check (role in ('employee', 'organization_admin')),
  constraint organization_memberships_status_check
    check (status in ('invited', 'active', 'suspended', 'revoked')),
  constraint organization_memberships_user_org_unique
    unique (organization_id, user_id)
);

create table public.platform_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  role text not null default 'friendly_forms_admin',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_memberships_role_check
    check (role = 'friendly_forms_admin'),
  constraint platform_memberships_status_check
    check (status in ('active', 'suspended', 'revoked'))
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

create trigger memberships_set_updated_at
before update on public.organization_memberships
for each row execute function private.set_updated_at();

create trigger platform_memberships_set_updated_at
before update on public.platform_memberships
for each row execute function private.set_updated_at();

create or replace function private.prevent_membership_identity_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.organization_id <> old.organization_id or new.user_id <> old.user_id then
    raise exception 'membership organization_id and user_id are immutable';
  end if;
  return new;
end;
$$;

create trigger memberships_identity_immutable
before update on public.organization_memberships
for each row execute function private.prevent_membership_identity_change();

create or replace function private.prevent_last_admin_removal()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.role = 'organization_admin'
    and old.status = 'active'
    and (new.role <> 'organization_admin' or new.status <> 'active')
    and not exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = old.organization_id
        and membership.id <> old.id
        and membership.role = 'organization_admin'
        and membership.status = 'active'
    ) then
    raise exception 'organization must retain an active organization administrator';
  end if;
  return new;
end;
$$;

create trigger memberships_last_admin_guard
before update on public.organization_memberships
for each row execute function private.prevent_last_admin_removal();

-- Narrow purpose: RLS and server authorization may ask whether the current
-- Supabase user has an active membership in one organization. It returns no
-- membership data and accepts no user id. Its fixed search_path is deliberate.
create or replace function private.is_active_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

-- Narrow purpose: RLS and server authorization may ask whether the current
-- user has one of the fixed organization roles. It returns only a boolean.
create or replace function private.has_organization_role(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role = 'organization_admin'
  );
$$;

-- Dedicated onboarding workflow. Ordinary clients cannot insert organizations
-- or bootstrap memberships with table CRUD. This function never grants the
-- platform role and is the only authenticated creation entry point.
create or replace function public.create_organization(organization_name text, organization_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  new_organization public.organizations;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if organization_name is null
    or length(btrim(organization_name)) = 0
    or length(btrim(organization_name)) > 200 then
    raise exception 'organization name is required';
  end if;

  if organization_slug is null
    or length(btrim(organization_slug)) = 0
    or length(btrim(organization_slug)) > 63 then
    raise exception 'organization slug is required';
  end if;

  insert into public.organizations (name, slug)
  values (btrim(organization_name), lower(btrim(organization_slug)))
  returning * into new_organization;

  insert into public.organization_memberships
    (organization_id, user_id, role, status)
  values
    (new_organization.id, current_user_id, 'organization_admin', 'active');

  return new_organization;
end;
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.is_active_member(uuid) to authenticated;
grant execute on function private.has_organization_role(uuid) to authenticated;
revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.platform_memberships enable row level security;

-- No direct INSERT policy: organization creation uses create_organization().
create policy organizations_select_member
on public.organizations
for select
to authenticated
using (private.is_active_member(id));

-- Ordinary organization administration cannot execute deletion transitions.
-- Those states belong to a dedicated, audited deletion workflow.
create policy organizations_update_admin
on public.organizations
for update
to authenticated
using (
  private.has_organization_role(id)
  and status in ('active', 'suspended')
)
with check (
  private.has_organization_role(id)
  and status in ('active', 'suspended')
);

-- No DELETE policy. Deletion is an explicit workflow, not CRUD.

create policy memberships_select_self_or_admin
on public.organization_memberships
for select
to authenticated
using (
  (user_id = auth.uid() and status <> 'revoked')
  or private.has_organization_role(organization_id)
);

-- Organization admins can manage tenant memberships. Platform roles live in
-- platform_memberships and cannot be created through tenant CRUD.
create policy memberships_insert_admin
on public.organization_memberships
for insert
to authenticated
with check (
  private.has_organization_role(organization_id)
);

create policy memberships_update_admin
on public.organization_memberships
for update
to authenticated
using (
  private.has_organization_role(organization_id)
)
with check (
  private.has_organization_role(organization_id)
);

-- No DELETE policy. Revocation is represented by status = 'revoked'; cleanup
-- is reserved for the explicit organization-deletion workflow.

comment on table public.organizations is
  'Tenant records. RLS derives access from active memberships; API authorization remains required.';
comment on table public.organization_memberships is
  'User-to-tenant memberships. RLS never treats client-supplied organization_id as proof of access.';
comment on table public.platform_memberships is
  'Platform roles are separate from tenant membership. No ordinary authenticated CRUD policies are provided.';
comment on function private.is_active_member(uuid) is
  'SECURITY DEFINER helper for membership-based RLS; returns only a boolean for auth.uid().';
comment on function private.has_organization_role(uuid) is
  'SECURITY DEFINER helper for organization-admin RLS; returns only a boolean for auth.uid().';
comment on function private.prevent_last_admin_removal() is
  'Non-definer trigger guard preventing demotion, suspension, or revocation of the last active organization administrator.';
comment on function public.create_organization(text, text) is
  'Dedicated authenticated onboarding workflow; not ordinary organization CRUD and never grants friendly_forms_admin.';
