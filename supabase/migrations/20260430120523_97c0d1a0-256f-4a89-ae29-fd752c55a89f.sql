ALTER TABLE public.attachments ADD COLUMN IF NOT EXISTS time_entry_id uuid REFERENCES public.time_entries(id) ON DELETE CASCADE;

ALTER TABLE public.attachments DROP CONSTRAINT IF EXISTS attachments_one_parent;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_one_parent CHECK (
  (CASE WHEN task_id IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN note_id IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN time_entry_id IS NOT NULL THEN 1 ELSE 0 END) = 1
);

CREATE INDEX IF NOT EXISTS idx_attachments_time_entry ON public.attachments(time_entry_id) WHERE time_entry_id IS NOT NULL;