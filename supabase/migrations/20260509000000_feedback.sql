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
