-- Base de données du site Épreuves
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
  file_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists exams_public_listing_idx
  on public.exams (status, campus, class_name, term, school_year, created_at desc);

alter table public.exams enable row level security;

-- Tout visiteur peut envoyer une proposition, mais elle reste en attente.
drop policy if exists "Visitors can submit pending exams" on public.exams;
create policy "Visitors can submit pending exams"
  on public.exams for insert
  to anon, authenticated
  with check (status = 'pending' and level = 'Secondaire');

-- Seules les épreuves validées sont visibles publiquement.
drop policy if exists "Visitors can read approved exams" on public.exams;
create policy "Visitors can read approved exams"
  on public.exams for select
  to anon, authenticated
  using (status = 'approved');

-- Stockage privé des PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exam-pdfs', 'exam-pdfs', false, 15728640, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = array['application/pdf'];

drop policy if exists "Visitors can upload exam PDFs" on storage.objects;
create policy "Visitors can upload exam PDFs"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'exam-pdfs' and name like 'pending/%');

-- Un PDF ne peut être lu que si son épreuve a été validée.
drop policy if exists "Visitors can read approved exam PDFs" on storage.objects;
create policy "Visitors can read approved exam PDFs"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'exam-pdfs'
    and exists (
      select 1 from public.exams
      where public.exams.file_path = storage.objects.name
        and public.exams.status = 'approved'
    )
  );

-- Validation : dans Supabase > Table Editor > exams, passer status de
-- "pending" à "approved" après vérification. Pour refuser, utiliser "rejected".
