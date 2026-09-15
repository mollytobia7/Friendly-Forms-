create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy app_settings_select_authenticated
on public.app_settings
for select
to authenticated
using (true);

create policy app_settings_insert_admin
on public.app_settings
for insert
to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (
    select 1
    from public.platform_memberships membership
    where membership.user_id = auth.uid()
      and membership.role = 'friendly_forms_admin'
      and membership.status = 'active'
  )
);

create policy app_settings_update_admin
on public.app_settings
for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (
    select 1
    from public.platform_memberships membership
    where membership.user_id = auth.uid()
      and membership.role = 'friendly_forms_admin'
      and membership.status = 'active'
  )
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (
    select 1
    from public.platform_memberships membership
    where membership.user_id = auth.uid()
      and membership.role = 'friendly_forms_admin'
      and membership.status = 'active'
  )
);

grant select, insert, update on table public.app_settings to authenticated;