# Organization and Membership RLS Test Plan

This plan covers only `organizations` and `organization_memberships`. It must run against a disposable Supabase/PostgreSQL database with seeded `auth.users` rows and authenticated JWT contexts. Do not use the service role for assertions about end-user access.

## Test fixtures

Create:

- `org_a` and `org_b`.
- `employee_a` active in `org_a`.
- `employee_b` active in `org_b`.
- `admin_a` active as `organization_admin` in `org_a`.
- `admin_b` active as `organization_admin` in `org_b`.
- `platform_admin` active as `friendly_forms_admin` in `platform_memberships`.
- `revoked_a` with a revoked membership in `org_a`.
- A nonexistent organization ID and nonexistent membership ID.

Run each case with the corresponding user's Supabase `authenticated` JWT context and verify both returned rows and mutation counts.

## Expected access matrix

| Actor | Read own org | Read other org | Manage own memberships | Manage other org | Direct org delete |
|---|---:|---:|---:|---:|---:|
| employee_a | allow | deny | deny | deny | deny |
| admin_a | allow | deny | allow | deny | deny |
| employee_b | allow | deny | deny | deny | deny |
| admin_b | allow | deny | allow | deny | deny |
| revoked_a | deny | deny | deny | deny | deny |
| platform_admin | deny by tenant RLS | deny by tenant RLS | deny by tenant RLS | deny by tenant RLS | deny |

Platform administration is intentionally tested through a separate audited workflow, not ordinary table CRUD.

## Required assertions

1. **Tenant membership resolution**
   - Employee A can select `org_a`.
   - Employee A cannot select `org_b`.
   - Employee B cannot select `org_a`.
   - A revoked member cannot select an organization.
   - A nonexistent organization returns no rows.

2. **Membership visibility**
   - A user can select their own non-revoked membership.
   - An organization admin can select memberships in their own organization.
   - An employee cannot enumerate another member's membership.
   - An admin from `org_a` cannot read memberships in `org_b`.
   - A deliberately supplied cross-tenant `organization_id` returns no rows.

3. **Organization creation**
   - An unauthenticated caller cannot call `create_organization`.
   - An authenticated user can create an organization through the dedicated function.
   - The function creates exactly one active `organization_admin` membership for the caller.
   - A caller cannot create a platform membership through tenant CRUD.
   - Duplicate slugs fail globally, including across organizations.

4. **Membership inserts**
   - An organization admin can invite or activate a user in their own organization.
   - An employee cannot insert a membership.
   - An admin from `org_a` cannot insert a membership into `org_b` by supplying `org_b` as the client organization ID.
   - A client cannot insert a platform membership through tenant CRUD.
   - Duplicate `(organization_id, user_id)` inserts fail.
   - A second active membership for the same user and organization fails.

5. **Membership updates**
   - An organization admin can change an employee's role among permitted tenant roles.
   - An employee cannot change their own role or status.
   - An admin cannot move a membership to another organization.
   - An admin cannot promote a membership to `friendly_forms_admin`.
   - A revoked membership cannot regain access without an authorized admin update.
   - An admin cannot demote, suspend, or revoke the last active organization admin.

6. **Deletes and status transitions**
   - Employees cannot delete memberships.
   - Organization admins cannot directly delete memberships.
   - No authenticated user can directly delete an organization.
   - Organization admins cannot set an organization to `deletion_requested`, `deleting`, or `deleted` through ordinary update CRUD.
   - Revocation is represented by `status = 'revoked'` and remains auditable.

7. **Nonexistent and cross-tenant resources**
   - Reads, inserts, updates, and deletes targeting nonexistent IDs fail closed or affect zero rows.
   - Every attempt using a valid resource ID with a deliberately supplied foreign `organization_id` is denied or affects zero rows.

## Results

Not executed in this workspace: the Supabase CLI, PostgreSQL client, and SQL linter are not installed. These tests require a disposable Supabase/PostgreSQL runtime and seeded authentication fixtures before they can produce runtime results.

Static review completed:

- Organization and membership tables are the only application tables in the migration.
- Organization deletion and platform-admin data access have no ordinary CRUD policy.
- Platform roles are stored separately from organization memberships.
- RLS helper functions derive identity from `auth.uid()` and return booleans only.
- Direct membership deletion has no policy.
- Tenant ownership is never inferred from client-supplied `organization_id` alone.
