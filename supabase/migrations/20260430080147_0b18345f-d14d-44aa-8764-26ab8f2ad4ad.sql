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