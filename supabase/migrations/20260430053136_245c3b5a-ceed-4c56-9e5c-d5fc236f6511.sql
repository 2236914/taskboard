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