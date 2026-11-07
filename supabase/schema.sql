create extension if not exists pgcrypto;
create table if not exists public.exams (
 id uuid primary key default gen_random_uuid(),
 campus text not null check (campus in ('Lomé','Atakpamé','Kara','Sokodé','Dapaong','Tsévié','Kpalimé')),
 level text not null default 'Secondaire', class_name text not null, series text,
 subject text not null, exam_type text not null check (exam_type in ('Devoir','Composition')),
 term smallint not null check (term between 1 and 3), number text not null, school_year text not null,
 notes text, file_path text not null unique,
 status text not null default 'approved' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now()
);
alter table public.exams alter column status set default 'approved';
update public.exams set status='approved' where status='pending';
create index if not exists exams_public_listing_idx on public.exams(status,campus,class_name,term,school_year,created_at desc);
alter table public.exams enable row level security;
drop policy if exists "Visitors can submit pending exams" on public.exams;
drop policy if exists "Visitors can read approved exams" on public.exams;
drop policy if exists "Everyone can read published exams" on public.exams;
drop policy if exists "Everyone can publish exams" on public.exams;
create policy "Everyone can read published exams" on public.exams for select to anon,authenticated using(status='approved');
revoke insert,update,delete on public.exams from anon,authenticated;
grant select on public.exams to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('exam-pdfs','exam-pdfs',true,15728640,array['application/pdf'])
on conflict(id) do update set public=true,file_size_limit=15728640,allowed_mime_types=array['application/pdf'];
drop policy if exists "Visitors can upload exam PDFs" on storage.objects;
drop policy if exists "Visitors can read approved exam PDFs" on storage.objects;
drop policy if exists "Everyone can upload exam PDFs" on storage.objects;
drop policy if exists "Everyone can read exam PDFs" on storage.objects;
create policy "Everyone can read exam PDFs" on storage.objects for select to anon,authenticated using(bucket_id='exam-pdfs');
revoke insert,update,delete on storage.objects from anon,authenticated;
create table if not exists public.exam_submission_limits(ip_hash text primary key,window_started_at timestamptz not null,submission_count integer not null default 0);
alter table public.exam_submission_limits enable row level security;
revoke all on public.exam_submission_limits from anon,authenticated;
create or replace function public.check_exam_submission_limit(p_ip_hash text)
returns boolean language plpgsql security definer set search_path=public as $$
declare allowed boolean;
begin
 insert into public.exam_submission_limits(ip_hash,window_started_at,submission_count) values(p_ip_hash,now(),1)
 on conflict(ip_hash) do update set
 window_started_at=case when public.exam_submission_limits.window_started_at < now()-interval '10 minutes' then now() else public.exam_submission_limits.window_started_at end,
 submission_count=case when public.exam_submission_limits.window_started_at < now()-interval '10 minutes' then 1 else public.exam_submission_limits.submission_count+1 end;
 select submission_count<=4 into allowed from public.exam_submission_limits where ip_hash=p_ip_hash;
 return allowed;
end; $$;
revoke all on function public.check_exam_submission_limit(text) from public,anon,authenticated;
grant execute on function public.check_exam_submission_limit(text) to service_role;
