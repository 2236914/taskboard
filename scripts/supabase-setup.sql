-- Combined Supabase schema for taskboard.
-- Generated from supabase/migrations/*.sql — paste into the Supabase SQL Editor.
-- https://supabase.com/dashboard/project/<your-ref>/sql/new


-- ============================================================
-- 20260430045047_ae61f01d-e884-4c17-aefb-033962f86b4a.sql
-- ============================================================

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- auto profile + default tags on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  insert into public.tags (user_id, name, color) values
    (new.id, 'Work', '#5055A0'),
    (new.id, 'Personal', '#3D6B3F'),
    (new.id, 'Urgent', '#A03030');
  return new;
end; $$;

-- tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#5055A0',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
alter table public.tags enable row level security;
create policy "tags_select_own" on public.tags for select using (auth.uid() = user_id);
create policy "tags_insert_own" on public.tags for insert with check (auth.uid() = user_id);
create policy "tags_update_own" on public.tags for update using (auth.uid() = user_id);
create policy "tags_delete_own" on public.tags for delete using (auth.uid() = user_id);

-- tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  note text,
  day text not null default 'mon',
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  tag_id uuid references public.tags(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tasks enable row level security;
create policy "tasks_select_own" on public.tasks for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks for update using (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks for delete using (auth.uid() = user_id);
create index tasks_user_day_idx on public.tasks(user_id, day);

-- day_notes
create table public.day_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_key date not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, day_key)
);
alter table public.day_notes enable row level security;
create policy "day_notes_select_own" on public.day_notes for select using (auth.uid() = user_id);
create policy "day_notes_insert_own" on public.day_notes for insert with check (auth.uid() = user_id);
create policy "day_notes_update_own" on public.day_notes for update using (auth.uid() = user_id);
create policy "day_notes_delete_own" on public.day_notes for delete using (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger day_notes_set_updated_at before update on public.day_notes
  for each row execute function public.set_updated_at();

-- new user trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 20260430045110_e7719e5a-3882-43e8-9383-2487156d11a8.sql
-- ============================================================

alter function public.set_updated_at() set search_path = public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ============================================================
-- 20260430050418_5919fc7c-3bc4-477d-ab98-1b4576562fa3.sql
-- ============================================================
ALTER TABLE public.tags
ADD COLUMN parent_id uuid REFERENCES public.tags(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS tags_parent_id_idx ON public.tags(parent_id);
-- ============================================================
-- 20260430053136_245c3b5a-ceed-4c56-9e5c-d5fc236f6511.sql
-- ============================================================
-- Add username to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create case-insensitive index for lookups
CREATE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles (LOWER(username));

-- Allow public read of (id, username) so login lookup works (no email exposed)
DROP POLICY IF EXISTS profiles_select_username_public ON public.profiles;
CREATE POLICY profiles_select_username_public ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (true);

-- Drop the old self-only select since the new one supersedes it
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;

-- Update handle_new_user to populate username from metadata (fallback to email prefix)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  uname text;
begin
  uname := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  insert into public.profiles (id, display_name, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', uname), uname);
  insert into public.tags (user_id, name, color) values
    (new.id, 'Work', '#5055A0'),
    (new.id, 'Personal', '#3D6B3F'),
    (new.id, 'Urgent', '#A03030');
  return new;
end; $function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC to resolve username -> email for sign-in
CREATE OR REPLACE FUNCTION public.email_for_username(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email::text
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE LOWER(p.username) = LOWER(_username)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.email_for_username(text) TO anon, authenticated;
-- ============================================================
-- 20260430075528_4e2d2007-626b-4ffc-9626-9f36a485671d.sql
-- ============================================================
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '',
  tag_id UUID REFERENCES public.tags(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_select_own" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notes_insert_own" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notes_update_own" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notes_delete_own" ON public.notes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER notes_set_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_notes_user_updated ON public.notes(user_id, updated_at DESC);
CREATE INDEX idx_notes_tag ON public.notes(tag_id);
-- ============================================================
-- 20260430080147_0b18345f-d14d-44aa-8764-26ab8f2ad4ad.sql
-- ============================================================
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

-- Switch sort_order to numeric so we can use fractional indexing
ALTER TABLE public.tasks
  ALTER COLUMN sort_order TYPE numeric USING sort_order::numeric;

ALTER TABLE public.tasks
  ALTER COLUMN sort_order SET DEFAULT 1000;

CREATE INDEX IF NOT EXISTS idx_tasks_user_day_status_sort
  ON public.tasks(user_id, day, status, sort_order);

CREATE INDEX IF NOT EXISTS idx_tasks_pinned ON public.tasks(pinned_at);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON public.notes(pinned_at);
-- ============================================================
-- 20260430092737_14fc2b3c-ee91-4ba8-9e4d-d68ea8d521f6.sql
-- ============================================================
-- ===== Attachments table =====
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  note_id UUID REFERENCES public.notes(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attachments_one_parent CHECK (
    (task_id IS NOT NULL AND note_id IS NULL) OR
    (task_id IS NULL AND note_id IS NOT NULL)
  )
);

CREATE INDEX idx_attachments_task ON public.attachments(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_attachments_note ON public.attachments(note_id) WHERE note_id IS NOT NULL;
CREATE INDEX idx_attachments_user ON public.attachments(user_id);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY attachments_select_own ON public.attachments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY attachments_insert_own ON public.attachments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY attachments_update_own ON public.attachments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY attachments_delete_own ON public.attachments FOR DELETE USING (auth.uid() = user_id);

-- ===== Storage bucket for attachments =====
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "attachments_read_own"
ON storage.objects FOR SELECT
USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "attachments_insert_own"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "attachments_update_own"
ON storage.objects FOR UPDATE
USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "attachments_delete_own"
ON storage.objects FOR DELETE
USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ===== Public note sharing =====
ALTER TABLE public.notes
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN public_slug TEXT UNIQUE;

CREATE INDEX idx_notes_public_slug ON public.notes(public_slug) WHERE public_slug IS NOT NULL;

CREATE POLICY notes_select_public ON public.notes
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

-- Allow public read of attachments belonging to public notes (for inline images in shared notes)
CREATE POLICY attachments_select_public_note ON public.attachments
  FOR SELECT
  TO anon, authenticated
  USING (
    note_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.notes n WHERE n.id = attachments.note_id AND n.is_public = true
    )
  );

-- ===== Due dates on tasks =====
ALTER TABLE public.tasks
  ADD COLUMN due_at TIMESTAMPTZ,
  ADD COLUMN reminder_offset_minutes INTEGER;

CREATE INDEX idx_tasks_due_at ON public.tasks(due_at) WHERE due_at IS NOT NULL;
-- ============================================================
-- 20260430105209_401757ef-ea7d-4c22-9ecf-d358992e7bd5.sql
-- ============================================================
-- Manual location override
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_label TEXT;

-- Time tracking
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_id UUID,
  tag_id UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_select_own" ON public.time_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "time_entries_insert_own" ON public.time_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "time_entries_update_own" ON public.time_entries
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "time_entries_delete_own" ON public.time_entries
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_started
  ON public.time_entries (user_id, started_at DESC);

-- Only one running timer per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_entries_one_running
  ON public.time_entries (user_id) WHERE ended_at IS NULL;

CREATE TRIGGER time_entries_set_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- ============================================================
-- 20260430120350_cb139a30-d26b-45f7-88fb-b353713a186b.sql
-- ============================================================
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS daily_target_minutes integer;
-- ============================================================
-- 20260430120523_97c0d1a0-256f-4a89-ae29-fd752c55a89f.sql
-- ============================================================
ALTER TABLE public.attachments ADD COLUMN IF NOT EXISTS time_entry_id uuid REFERENCES public.time_entries(id) ON DELETE CASCADE;

ALTER TABLE public.attachments DROP CONSTRAINT IF EXISTS attachments_one_parent;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_one_parent CHECK (
  (CASE WHEN task_id IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN note_id IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN time_entry_id IS NOT NULL THEN 1 ELSE 0 END) = 1
);

CREATE INDEX IF NOT EXISTS idx_attachments_time_entry ON public.attachments(time_entry_id) WHERE time_entry_id IS NOT NULL;
-- ============================================================
-- 20260501042717_a912e79b-a4a1-43f4-a2d6-10131773c10a.sql
-- ============================================================

-- 1) Restrict profiles SELECT: drop overly-permissive policy and only allow
--    public read of profiles that authored a public note.
DROP POLICY IF EXISTS profiles_select_username_public ON public.profiles;

CREATE POLICY profiles_select_public_note_author
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.notes n
    WHERE n.user_id = profiles.id AND n.is_public = true
  )
);

-- 2) Lock down email_for_username: revoke from authenticated; keep anon (needed
--    by the username-based sign-in flow on the public auth page).
REVOKE EXECUTE ON FUNCTION public.email_for_username(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_for_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_for_username(text) TO anon;

-- 3) Storage: allow reading attachment files that are linked to public notes.
CREATE POLICY "Public note attachments are readable"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'attachments'
  AND EXISTS (
    SELECT 1
    FROM public.attachments a
    JOIN public.notes n ON n.id = a.note_id
    WHERE a.file_path = storage.objects.name
      AND n.is_public = true
  )
);

-- ============================================================
-- 20260509000000_feedback.sql
-- ============================================================
-- Feedback table — auth-gated submissions with optional image attachments.
-- Images are stored in the existing "attachments" Supabase Storage bucket
-- under "{userId}/feedback/{feedbackId}/{filename}" so the per-user folder
-- RLS policies on storage.objects keep working as-is.

CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('bug','feature','praise','other')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  image_paths TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','seen','responded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Owner can read / insert / update their own rows. No DELETE — keeps an
-- audit trail. Project owner reads everything via the service-role client.
CREATE POLICY "feedback_select_own" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "feedback_insert_own" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "feedback_update_own" ON public.feedback
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_feedback_user_created
  ON public.feedback(user_id, created_at DESC);
CREATE INDEX idx_feedback_status ON public.feedback(status);

CREATE TRIGGER feedback_set_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 20260509120000_admin_role.sql
-- ============================================================
-- Admin role: a single boolean on `profiles` (default false) plus a small
-- SECURITY DEFINER helper so RLS policies can ask "is the caller an admin?"
-- without recursing into the same table's policies. To grant admin to
-- yourself in production, run:
--   UPDATE public.profiles SET is_admin = true WHERE id = '<your auth.uid>';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Admins can read every profile (so feedback rows can show submitter
-- usernames / display names).
CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can read every feedback row, regardless of who submitted it.
CREATE POLICY feedback_select_admin ON public.feedback
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can change feedback status (mark as seen / responded).
CREATE POLICY feedback_update_admin ON public.feedback
  FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Storage: admins can read every attachment (so they can preview screenshots
-- in feedback submissions from any user).
CREATE POLICY "Admins can read all attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments' AND public.is_admin()
);

-- ============================================================
-- 20260509180000_profile_timezone.sql
-- ============================================================
-- Manual timezone override on profiles.
-- When set, the live clock + headers format times in this zone instead of
-- the browser's auto-detected tz. Plays alongside the existing
-- location_label string (which is purely display).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT;
