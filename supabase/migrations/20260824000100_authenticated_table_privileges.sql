-- Grants required for the existing membership-derived RLS policies to run.
-- These grants do not authorize cross-tenant access; RLS remains enforced.
-- Application/API authorization remains mandatory defense in depth.

grant select on table public.organizations to authenticated;
grant update on table public.organizations to authenticated;

grant select, insert, update on table public.organization_memberships to authenticated;

comment on table public.organizations is
  'Tenant records. Table grants permit policy evaluation; RLS derives access from active memberships.';
comment on table public.organization_memberships is
  'User-to-tenant memberships. Table grants permit policy evaluation; RLS controls tenant and role access.';
