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