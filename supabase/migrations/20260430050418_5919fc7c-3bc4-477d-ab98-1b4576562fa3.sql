ALTER TABLE public.tags
ADD COLUMN parent_id uuid REFERENCES public.tags(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS tags_parent_id_idx ON public.tags(parent_id);