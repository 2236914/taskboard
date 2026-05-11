-- Per-tag timezone. When set, the tag chip + tag manager surface the
-- current time in this zone — handy when a tag represents a remote client
-- or team in a different timezone.
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS timezone TEXT;
