-- ============================================================================
-- Normalize RBAC and multitenant compatibility
-- Safe to run multiple times
-- ============================================================================

-- 1) Membership compatibility columns
ALTER TABLE IF EXISTS public.memberships
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.memberships
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.memberships
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'org_user';

ALTER TABLE IF EXISTS public.memberships
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE IF EXISTS public.memberships
  ADD COLUMN IF NOT EXISTS role_id UUID;

ALTER TABLE IF EXISTS public.memberships
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id);

ALTER TABLE IF EXISTS public.memberships
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.memberships
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.memberships
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.memberships
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES auth.users(id);

ALTER TABLE IF EXISTS public.memberships
  ADD COLUMN IF NOT EXISTS user_type TEXT;

UPDATE public.memberships
SET organization_id = org_id
WHERE organization_id IS NULL
  AND org_id IS NOT NULL;

UPDATE public.memberships
SET org_id = organization_id
WHERE org_id IS NULL
  AND organization_id IS NOT NULL;

UPDATE public.memberships
SET status = 'active'
WHERE status IS NULL OR btrim(status) = '';

UPDATE public.memberships
SET role = 'org_user'
WHERE role IS NULL OR btrim(role) = '';

CREATE OR REPLACE FUNCTION public.sync_membership_org_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.org_id IS NOT NULL THEN
    NEW.organization_id := NEW.org_id;
  END IF;

  IF NEW.org_id IS NULL AND NEW.organization_id IS NOT NULL THEN
    NEW.org_id := NEW.organization_id;
  END IF;

  IF NEW.status IS NULL OR btrim(NEW.status) = '' THEN
    NEW.status := 'active';
  END IF;

  IF NEW.role IS NULL OR btrim(NEW.role) = '' THEN
    NEW.role := 'org_user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_membership_org_columns ON public.memberships;
CREATE TRIGGER trg_sync_membership_org_columns
BEFORE INSERT OR UPDATE ON public.memberships
FOR EACH ROW
EXECUTE FUNCTION public.sync_membership_org_columns();

CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_user_org_unique
  ON public.memberships (user_id, COALESCE(organization_id, org_id));

CREATE INDEX IF NOT EXISTS idx_memberships_org_status
  ON public.memberships (COALESCE(organization_id, org_id), status);

CREATE INDEX IF NOT EXISTS idx_memberships_role
  ON public.memberships (role);

-- 2) Role catalog
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.user_roles
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE IF EXISTS public.user_roles
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS public.user_roles
  ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN DEFAULT FALSE;

ALTER TABLE IF EXISTS public.user_roles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.user_roles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.user_roles
SET permissions = '[]'::jsonb
WHERE permissions IS NULL;

INSERT INTO public.user_roles (name, description, permissions, is_system_role)
SELECT 'master', 'Full access to all resources and CRUD operations', '["*"]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE lower(name) = 'master');

UPDATE public.user_roles
SET description = 'Full access to all resources and CRUD operations',
    permissions = '["*"]'::jsonb,
    is_system_role = TRUE
WHERE lower(name) = 'master';

INSERT INTO public.user_roles (name, description, permissions, is_system_role)
SELECT 'super_user', 'Can create organizations and users across tenants', '["organizations:create","users:create","users:assign"]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE lower(name) = 'super_user');

UPDATE public.user_roles
SET description = 'Can create organizations and users across tenants',
    permissions = '["organizations:create","users:create","users:assign"]'::jsonb,
    is_system_role = TRUE
WHERE lower(name) = 'super_user';

INSERT INTO public.user_roles (name, description, permissions, is_system_role)
SELECT 'org_admin', 'Manages users and access inside own organization', '["organization:read","organization:users:manage"]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE lower(name) = 'org_admin');

UPDATE public.user_roles
SET description = 'Manages users and access inside own organization',
    permissions = '["organization:read","organization:users:manage"]'::jsonb,
    is_system_role = TRUE
WHERE lower(name) = 'org_admin';

INSERT INTO public.user_roles (name, description, permissions, is_system_role)
SELECT 'org_user', 'Standard organization user', '["organization:read"]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE lower(name) = 'org_user');

UPDATE public.user_roles
SET description = 'Standard organization user',
    permissions = '["organization:read"]'::jsonb,
    is_system_role = TRUE
WHERE lower(name) = 'org_user';

-- Optional legacy aliases so old payloads still resolve
INSERT INTO public.user_roles (name, description, permissions, is_system_role)
VALUES
  ('super_admin', 'Legacy alias for super_user', '["organizations:create","users:create","users:assign"]'::jsonb, TRUE),
  ('admin', 'Legacy alias for org_admin', '["organization:read","organization:users:manage"]'::jsonb, TRUE),
  ('owner', 'Legacy alias for org_admin', '["organization:read","organization:users:manage"]'::jsonb, TRUE),
  ('member', 'Legacy alias for org_user', '["organization:read"]'::jsonb, TRUE)
ON CONFLICT (name) DO NOTHING;

-- 3) Privileged user tables
CREATE TABLE IF NOT EXISTS public.master_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_users_active ON public.master_users (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_super_admins_active ON public.super_admins (user_id, is_active);

-- 4) Invite compatibility
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT,
  role_id UUID,
  token UUID NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.organization_invites
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.organization_invites
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.organization_invites
  ADD COLUMN IF NOT EXISTS role TEXT;

ALTER TABLE IF EXISTS public.organization_invites
  ADD COLUMN IF NOT EXISTS role_id UUID;

ALTER TABLE IF EXISTS public.organization_invites
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

ALTER TABLE IF EXISTS public.organization_invites
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id);

ALTER TABLE IF EXISTS public.organization_invites
  ADD COLUMN IF NOT EXISTS token UUID;

ALTER TABLE IF EXISTS public.organization_invites
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.organization_invites
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

UPDATE public.organization_invites
SET organization_id = org_id
WHERE organization_id IS NULL
  AND org_id IS NOT NULL;

UPDATE public.organization_invites
SET org_id = organization_id
WHERE org_id IS NULL
  AND organization_id IS NOT NULL;

UPDATE public.organization_invites
SET status = 'pending'
WHERE status IS NULL OR btrim(status) = '';

CREATE OR REPLACE FUNCTION public.sync_invite_org_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.org_id IS NOT NULL THEN
    NEW.organization_id := NEW.org_id;
  END IF;

  IF NEW.org_id IS NULL AND NEW.organization_id IS NOT NULL THEN
    NEW.org_id := NEW.organization_id;
  END IF;

  IF NEW.status IS NULL OR btrim(NEW.status) = '' THEN
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invite_org_columns ON public.organization_invites;
CREATE TRIGGER trg_sync_invite_org_columns
BEFORE INSERT OR UPDATE ON public.organization_invites
FOR EACH ROW
EXECUTE FUNCTION public.sync_invite_org_columns();

CREATE INDEX IF NOT EXISTS idx_org_invites_org_status
  ON public.organization_invites (COALESCE(organization_id, org_id), status);

CREATE INDEX IF NOT EXISTS idx_org_invites_email
  ON public.organization_invites (email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invites_token
  ON public.organization_invites (token);

-- 5) Compatibility view for older codepaths expecting organization_memberships
DO $$
BEGIN
  IF to_regclass('public.organization_memberships') IS NULL THEN
    EXECUTE $view$
      CREATE VIEW public.organization_memberships AS
      SELECT
        m.id,
        m.user_id,
        COALESCE(m.org_id, m.organization_id) AS org_id,
        COALESCE(m.organization_id, m.org_id) AS organization_id,
        m.role,
        m.status,
        m.created_at,
        m.updated_at,
        m.invited_by,
        m.invited_at,
        m.accepted_at,
        m.removed_at,
        m.removed_by
      FROM public.memberships m
    $view$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'organization_memberships'
      AND c.relkind = 'v'
  ) THEN
    CREATE OR REPLACE FUNCTION public.organization_memberships_view_write()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    DECLARE
      resolved_org_id UUID;
      upserted_id UUID;
    BEGIN
      IF TG_OP = 'INSERT' THEN
        resolved_org_id := COALESCE(NEW.organization_id, NEW.org_id);
        IF resolved_org_id IS NULL THEN
          RAISE EXCEPTION 'organization_id/org_id is required';
        END IF;

        UPDATE public.memberships
        SET
          role = COALESCE(NEW.role, role),
          status = COALESCE(NEW.status, status),
          accepted_at = COALESCE(NEW.accepted_at, accepted_at),
          invited_by = COALESCE(NEW.invited_by, invited_by),
          invited_at = COALESCE(NEW.invited_at, invited_at),
          removed_at = COALESCE(NEW.removed_at, removed_at),
          removed_by = COALESCE(NEW.removed_by, removed_by),
          organization_id = resolved_org_id,
          org_id = resolved_org_id
        WHERE user_id = NEW.user_id
          AND COALESCE(organization_id, org_id) = resolved_org_id
        RETURNING id INTO upserted_id;

        IF upserted_id IS NULL THEN
          INSERT INTO public.memberships (
            user_id,
            organization_id,
            org_id,
            role,
            status,
            invited_by,
            invited_at,
            accepted_at,
            removed_at,
            removed_by
          )
          VALUES (
            NEW.user_id,
            resolved_org_id,
            resolved_org_id,
            COALESCE(NEW.role, 'org_user'),
            COALESCE(NEW.status, 'active'),
            NEW.invited_by,
            COALESCE(NEW.invited_at, NOW()),
            NEW.accepted_at,
            NEW.removed_at,
            NEW.removed_by
          );
        END IF;

        RETURN NEW;
      ELSIF TG_OP = 'UPDATE' THEN
        resolved_org_id := COALESCE(NEW.organization_id, NEW.org_id, OLD.organization_id, OLD.org_id);

        UPDATE public.memberships
        SET
          user_id = COALESCE(NEW.user_id, user_id),
          role = COALESCE(NEW.role, role),
          status = COALESCE(NEW.status, status),
          invited_by = COALESCE(NEW.invited_by, invited_by),
          invited_at = COALESCE(NEW.invited_at, invited_at),
          accepted_at = COALESCE(NEW.accepted_at, accepted_at),
          removed_at = COALESCE(NEW.removed_at, removed_at),
          removed_by = COALESCE(NEW.removed_by, removed_by),
          organization_id = COALESCE(resolved_org_id, organization_id),
          org_id = COALESCE(resolved_org_id, org_id)
        WHERE id = OLD.id;

        RETURN NEW;
      ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public.memberships WHERE id = OLD.id;
        RETURN OLD;
      END IF;

      RETURN NULL;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS trg_organization_memberships_view_write ON public.organization_memberships;
    CREATE TRIGGER trg_organization_memberships_view_write
    INSTEAD OF INSERT OR UPDATE OR DELETE ON public.organization_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.organization_memberships_view_write();
  END IF;
END $$;
