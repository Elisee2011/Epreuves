-- Base de données publique du site Épreuves
-- À exécuter dans Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  campus text not null check (campus in ('Lomé','Atakpamé','Kara','Sokodé','Dapaong','Tsévié','Kpalimé')),
  level text not null default 'Secondaire',
  class_name text not null,
  series text,
  subject text not null,
  exam_type text not null check (exam_type in ('Devoir','Composition')),
  term smallint not null check (term between 1 and 3),
  number text not null,
  school_year text not null,
  notes text,
  file_path text not null unique,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

-- Mise à niveau d'une table créée avec l'ancien schéma.
alter table public.exams alter column status set default 'approved';
update public.exams set status = 'approved' where status = 'pending';

create index if not exists exams_public_listing_idx
  on public.exams (status, campus, class_name, term, school_year, created_at desc);

alter table public.exams enable row level security;

drop policy if exists "Visitors can submit pending exams" on public.exams;
drop policy if exists "Visitors can read approved exams" on public.exams;
drop policy if exists "Everyone can read published exams" on public.exams;
drop policy if exists "Everyone can publish exams" on public.exams;

create policy "Everyone can read published exams"
  on public.exams for select to anon, authenticated
  using (status = 'approved');

create policy "Everyone can publish exams"
  on public.exams for insert to anon, authenticated
  with check (status = 'approved' and level = 'Secondaire');

grant select, insert on public.exams to anon, authenticated;

-- Bucket public : les PDF publiés sont lisibles sans compte.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exam-pdfs', 'exam-pdfs', true, 15728640, array['application/pdf'])
on conflict (id) do update set
  public = true,
  file_size_limit = 15728640,
  allowed_mime_types = array['application/pdf'];

drop policy if exists "Visitors can upload exam PDFs" on storage.objects;
drop policy if exists "Visitors can read approved exam PDFs" on storage.objects;
drop policy if exists "Everyone can upload exam PDFs" on storage.objects;
drop policy if exists "Everyone can read exam PDFs" on storage.objects;

create policy "Everyone can upload exam PDFs"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'exam-pdfs' and name like 'files/%');

create policy "Everyone can read exam PDFs"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'exam-pdfs');

-- Aucun droit public de modification ou de suppression n'est accordé.
