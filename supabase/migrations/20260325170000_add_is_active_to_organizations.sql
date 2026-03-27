-- Backward compatibility for admin APIs that read organizations.is_active
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.organizations
SET is_active = TRUE
WHERE is_active IS NULL;
