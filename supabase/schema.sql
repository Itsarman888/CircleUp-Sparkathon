-- Suggested schema for a FUTURE Supabase integration.
-- Review and test in a separate development project before using real student data.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  branch text not null default 'Other',
  study_year text not null default 'Other',
  bio text not null default '' check (char_length(bio) <= 500),
  preferred_format text not null default 'Both' check (preferred_format in ('Online','In-person','Both')),
  created_at timestamptz not null default now()
);
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);
create table if not exists public.student_skills (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  skill_type text not null check (skill_type in ('offer','want')),
  unique(student_id,skill_id,skill_type)
);
create table if not exists public.exchange_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null check (char_length(topic) between 1 and 120),
  offer text not null check (char_length(offer) between 1 and 120),
  preferred_format text not null default 'Either works',
  message text not null default '' check (char_length(message)<=500),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','completed')),
  created_at timestamptz not null default now(),
  check(sender_id<>recipient_id)
);
alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.student_skills enable row level security;
alter table public.exchange_requests enable row level security;

create policy "Authenticated users can view profiles" on public.profiles for select to authenticated using(true);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check(auth.uid()=id);
create policy "Users update own profile" on public.profiles for update to authenticated using(auth.uid()=id) with check(auth.uid()=id);
create policy "Authenticated users view skills" on public.skills for select to authenticated using(true);
create policy "Authenticated users view skill links" on public.student_skills for select to authenticated using(true);
create policy "Users add own skill links" on public.student_skills for insert to authenticated with check(auth.uid()=student_id);
create policy "Users update own skill links" on public.student_skills for update to authenticated using(auth.uid()=student_id) with check(auth.uid()=student_id);
create policy "Users delete own skill links" on public.student_skills for delete to authenticated using(auth.uid()=student_id);
create policy "Participants view requests" on public.exchange_requests for select to authenticated using(auth.uid()=sender_id or auth.uid()=recipient_id);
create policy "Sender creates requests" on public.exchange_requests for insert to authenticated with check(auth.uid()=sender_id and sender_id<>recipient_id);
-- Before production, replace a broad update policy with a server-side RPC/trigger that
-- enforces valid status transitions and prevents participants from editing immutable fields.
