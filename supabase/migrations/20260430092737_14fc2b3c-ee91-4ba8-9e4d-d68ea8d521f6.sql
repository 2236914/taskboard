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