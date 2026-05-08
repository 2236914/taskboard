
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
