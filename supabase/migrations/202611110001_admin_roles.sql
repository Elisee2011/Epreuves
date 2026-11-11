-- Épreuves: rôles administrateurs et modération des dépôts
-- À exécuter dans Supabase > SQL Editor après avoir créé le compte super-admin.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin','admin')),
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid())
      and a.role in ('admin','super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid())
      and a.role = 'super_admin'
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_super_admin() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

drop policy if exists "admins_read_admins" on public.admins;
create policy "admins_read_admins"
on public.admins for select to authenticated
using (public.is_admin());

drop policy if exists "admins_super_admin_insert" on public.admins;
create policy "admins_super_admin_insert"
on public.admins for insert to authenticated
with check (public.is_super_admin() and role = 'admin');

drop policy if exists "admins_super_admin_update" on public.admins;
create policy "admins_super_admin_update"
on public.admins for update to authenticated
using (public.is_super_admin() and role = 'admin')
with check (public.is_super_admin() and role = 'admin');

drop policy if exists "admins_super_admin_delete" on public.admins;
create policy "admins_super_admin_delete"
on public.admins for delete to authenticated
using (public.is_super_admin() and role = 'admin');

-- Remplace toutes les anciennes règles de la table exams pour éviter
-- qu'une ancienne règle publique autorise encore les modifications.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'exams'
  loop
    execute format('drop policy %I on public.exams', p.policyname);
  end loop;
end $$;

alter table public.exams enable row level security;

create policy "exams_public_read_approved"
on public.exams for select to anon, authenticated
using (status = 'approved' or (select public.is_admin()));

create policy "exams_admin_insert"
on public.exams for insert to authenticated
with check ((select public.is_admin()));

create policy "exams_admin_update"
on public.exams for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "exams_admin_delete"
on public.exams for delete to authenticated
using ((select public.is_admin()));

-- Attribution du rôle super_admin au compte indiqué, s'il existe déjà.
insert into public.admins (user_id, role)
select id, 'super_admin'
from auth.users
where lower(email) = lower('eliseeedemagbebavi@gmail.com')
on conflict (user_id) do update set role = 'super_admin';

-- Vérification: cette requête doit retourner une ligne.
select u.email, a.role
from public.admins a
join auth.users u on u.id = a.user_id
where lower(u.email) = lower('eliseeedemagbebavi@gmail.com');
