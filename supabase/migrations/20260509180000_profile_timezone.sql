-- Manual timezone override on profiles.
-- When set, the live clock + headers format times in this zone instead of
-- the browser's auto-detected tz. Plays alongside the existing
-- location_label string (which is purely display).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT;
