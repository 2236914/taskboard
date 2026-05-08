
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
