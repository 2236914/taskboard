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
