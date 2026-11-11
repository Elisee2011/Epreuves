-- Épreuves : rôles et modération des dépôts.
-- Les fonctions de contrôle sont placées dans le schéma privé pour ne pas les exposer via l'API.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin','admin')),
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;
grant select, insert, update, delete on public.admins to authenticated;
grant all on public.admins to service_role;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins a
    where a.user_id = (select auth.uid()) and a.role in ('admin','super_admin'));
$$;

create or replace function private.is_super_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins a
    where a.user_id = (select auth.uid()) and a.role = 'super_admin');
$$;

revoke all on function private.is_admin() from public, anon, authenticated;
revoke all on function private.is_super_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_super_admin() to authenticated;

drop policy if exists "admins_read_admins" on public.admins;
create policy "admins_read_admins" on public.admins
for select to authenticated using ((select private.is_admin()));

drop policy if exists "admins_super_admin_insert" on public.admins;
create policy "admins_super_admin_insert" on public.admins
for insert to authenticated with check ((select private.is_super_admin()) and role = 'admin');

drop policy if exists "admins_super_admin_update" on public.admins;
create policy "admins_super_admin_update" on public.admins
for update to authenticated
using ((select private.is_super_admin()) and role = 'admin')
with check ((select private.is_super_admin()) and role = 'admin');

drop policy if exists "admins_super_admin_delete" on public.admins;
create policy "admins_super_admin_delete" on public.admins
for delete to authenticated using ((select private.is_super_admin()) and role = 'admin');

drop policy if exists "Everyone can read published exams" on public.exams;
drop policy if exists "exams_public_read_approved" on public.exams;
drop policy if exists "exams_admin_insert" on public.exams;
drop policy if exists "exams_admin_update" on public.exams;
drop policy if exists "exams_admin_delete" on public.exams;

revoke all on table public.exams from anon, authenticated;
grant select on public.exams to anon;
grant select, insert, update, delete on public.exams to authenticated;
grant all on public.exams to service_role;

create policy "exams_public_read_approved" on public.exams
for select to anon, authenticated
using (status = 'approved' or (select private.is_admin()));

create policy "exams_admin_insert" on public.exams
for insert to authenticated with check ((select private.is_admin()));

create policy "exams_admin_update" on public.exams
for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "exams_admin_delete" on public.exams
for delete to authenticated using ((select private.is_admin()));

-- Le compte principal reçoit automatiquement le rôle lors de sa création Auth.
create or replace function private.grant_initial_super_admin()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if lower(coalesce(new.email, '')) = lower('eliseeedemagbebavi@gmail.com') then
    insert into public.admins(user_id, role) values (new.id, 'super_admin')
    on conflict (user_id) do update set role = 'super_admin';
  end if;
  return new;
end;
$$;
revoke all on function private.grant_initial_super_admin() from public, anon, authenticated;
drop trigger if exists grant_initial_super_admin_after_signup on auth.users;
create trigger grant_initial_super_admin_after_signup
after insert on auth.users for each row
execute function private.grant_initial_super_admin();

insert into public.admins(user_id, role)
select id, 'super_admin' from auth.users
where lower(email) = lower('eliseeedemagbebavi@gmail.com')
on conflict (user_id) do update set role = 'super_admin';
