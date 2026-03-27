-- ============================================================================
-- Stabilize multitenant / RBAC
-- Canonical organization field: organization_id
-- Legacy compatibility: org_id remains mirrored
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Shared timestamp helper
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- Organizations
-- ----------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free';

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Roles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system_role BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_name_key'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_name_key UNIQUE (name);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER trg_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.user_roles (name, description, permissions, is_system_role)
SELECT 'master', 'Global platform owner', '["*"]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE lower(name) = 'master');

INSERT INTO public.user_roles (name, description, permissions, is_system_role)
SELECT 'super_user', 'Platform operator that can create organizations and users', '["organizations:create","organizations:read","organizations:update","users:create","users:read","users:update","memberships:create","memberships:read","memberships:update","invites:create","invites:read","invites:update"]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE lower(name) = 'super_user');

INSERT INTO public.user_roles (name, description, permissions, is_system_role)
SELECT 'org_admin', 'Organization administrator', '["organizations:read","organizations:update","users:create","users:read","users:update","memberships:create","memberships:read","memberships:update","invites:create","invites:read","invites:update"]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE lower(name) = 'org_admin');

INSERT INTO public.user_roles (name, description, permissions, is_system_role)
SELECT 'org_user', 'Organization member', '["organizations:read","users:read","memberships:read","invites:read"]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE lower(name) = 'org_user');

-- Legacy aliases kept for compatibility with older code paths
INSERT INTO public.user_roles (name, description, permissions, is_system_role)
SELECT 'super_admin', 'Legacy alias for super_user', '["organizations:create","organizations:read","organizations:update","users:create","users:read","users:update","memberships:create","memberships:read","memberships:update","invites:create","invites:read","invites:update"]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE lower(name) = 'super_admin');

INSERT INTO public.user_roles (name, description, permissions, is_system_role)
SELECT 'owner', 'Legacy alias for org_admin', '["organizations:read","organizations:update","users:create","users:read","users:update","memberships:create","memberships:read","memberships:update","invites:create","invites:read","invites:update"]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE lower(name) = 'owner');

INSERT INTO public.user_roles (name, description, permissions, is_system_role)
SELECT 'admin', 'Legacy alias for org_admin', '["organizations:read","organizations:update","users:create","users:read","users:update","memberships:create","memberships:read","memberships:update","invites:create","invites:read","invites:update"]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE lower(name) = 'admin');

INSERT INTO public.user_roles (name, description, permissions, is_system_role)
SELECT 'member', 'Legacy alias for org_user', '["organizations:read","users:read","memberships:read","invites:read"]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE lower(name) = 'member');

-- ----------------------------------------------------------------------------
-- Global access tables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.master_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.master_users
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.master_users
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.master_users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.master_users
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.master_users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.super_admins
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.super_admins
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.super_admins
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.super_admins
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.super_admins
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'master_users_user_id_key'
  ) THEN
    ALTER TABLE public.master_users ADD CONSTRAINT master_users_user_id_key UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'super_admins_user_id_key'
  ) THEN
    ALTER TABLE public.super_admins ADD CONSTRAINT super_admins_user_id_key UNIQUE (user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_master_users_updated_at ON public.master_users;
CREATE TRIGGER trg_master_users_updated_at
BEFORE UPDATE ON public.master_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_super_admins_updated_at ON public.super_admins;
CREATE TRIGGER trg_super_admins_updated_at
BEFORE UPDATE ON public.super_admins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Memberships
-- ----------------------------------------------------------------------------
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'org_user';

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS role_id UUID;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.memberships
SET organization_id = COALESCE(organization_id, org_id),
    org_id = COALESCE(org_id, organization_id)
WHERE organization_id IS NULL OR org_id IS NULL;

UPDATE public.memberships m
SET role_id = r.id
FROM public.user_roles r
WHERE m.role_id IS NULL
  AND m.role IS NOT NULL
  AND lower(r.name) = lower(m.role);

UPDATE public.memberships m
SET role = r.name
FROM public.user_roles r
WHERE m.role_id IS NOT NULL
  AND m.role IS NULL
  AND r.id = m.role_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'memberships_role_id_fkey'
  ) THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT memberships_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES public.user_roles(id) ON DELETE SET NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_memberships_updated_at ON public.memberships;
CREATE TRIGGER trg_memberships_updated_at
BEFORE UPDATE ON public.memberships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_id ON public.memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_memberships_organization_id ON public.memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships(status);
CREATE INDEX IF NOT EXISTS idx_memberships_role_id ON public.memberships(role_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_org_lookup ON public.memberships(user_id, COALESCE(organization_id, org_id));

-- ----------------------------------------------------------------------------
-- Invites
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'org_user',
  role_id UUID,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS token TEXT;

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'org_user';

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS role_id UUID;

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.organization_invites
SET organization_id = COALESCE(organization_id, org_id),
    org_id = COALESCE(org_id, organization_id);

UPDATE public.organization_invites i
SET role_id = r.id
FROM public.user_roles r
WHERE i.role_id IS NULL
  AND i.role IS NOT NULL
  AND lower(r.name) = lower(i.role);

UPDATE public.organization_invites i
SET role = r.name
FROM public.user_roles r
WHERE i.role_id IS NOT NULL
  AND i.role IS NULL
  AND r.id = i.role_id;

UPDATE public.organization_invites
SET email = lower(trim(email))
WHERE email IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_invites_role_id_fkey'
  ) THEN
    ALTER TABLE public.organization_invites
      ADD CONSTRAINT organization_invites_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES public.user_roles(id) ON DELETE SET NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_organization_invites_updated_at ON public.organization_invites;
CREATE TRIGGER trg_organization_invites_updated_at
BEFORE UPDATE ON public.organization_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_organization_invites_org_id ON public.organization_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_invites_organization_id ON public.organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invites_email ON public.organization_invites(lower(email));
CREATE INDEX IF NOT EXISTS idx_organization_invites_status ON public.organization_invites(status);
CREATE INDEX IF NOT EXISTS idx_organization_invites_role_id ON public.organization_invites(role_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_invites_token_key'
  ) THEN
    ALTER TABLE public.organization_invites
      ADD CONSTRAINT organization_invites_token_key UNIQUE (token);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Normalization triggers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_multitenant_scope_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  resolved_role_id UUID;
  resolved_role_name TEXT;
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := NEW.org_id;
  END IF;

  IF NEW.org_id IS NULL THEN
    NEW.org_id := NEW.organization_id;
  END IF;

  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id or org_id is required';
  END IF;

  NEW.org_id := NEW.organization_id;

  IF NEW.role IS NULL OR NEW.role = '' THEN
    NEW.role := 'org_user';
  END IF;

  IF NEW.role_id IS NULL AND NEW.role IS NOT NULL THEN
    SELECT ur.id, ur.name
      INTO resolved_role_id, resolved_role_name
    FROM public.user_roles ur
    WHERE lower(ur.name) = lower(NEW.role)
    LIMIT 1;

    IF resolved_role_id IS NOT NULL THEN
      NEW.role_id := resolved_role_id;
      NEW.role := resolved_role_name;
    END IF;
  ELSIF NEW.role_id IS NOT NULL AND (NEW.role IS NULL OR NEW.role = '') THEN
    SELECT ur.name
      INTO resolved_role_name
    FROM public.user_roles ur
    WHERE ur.id = NEW.role_id
    LIMIT 1;

    IF resolved_role_name IS NOT NULL THEN
      NEW.role := resolved_role_name;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'memberships' THEN
    NEW.status := COALESCE(NULLIF(NEW.status, ''), 'active');
  ELSIF TG_TABLE_NAME = 'organization_invites' THEN
    NEW.status := COALESCE(NULLIF(NEW.status, ''), 'pending');

    IF NEW.email IS NOT NULL THEN
      NEW.email := lower(trim(NEW.email));
    END IF;

    IF NEW.token IS NULL OR NEW.token = '' THEN
      NEW.token := gen_random_uuid()::text;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memberships_sync_scope ON public.memberships;
CREATE TRIGGER trg_memberships_sync_scope
BEFORE INSERT OR UPDATE ON public.memberships
FOR EACH ROW
EXECUTE FUNCTION public.sync_multitenant_scope_fields();

DROP TRIGGER IF EXISTS trg_organization_invites_sync_scope ON public.organization_invites;
CREATE TRIGGER trg_organization_invites_sync_scope
BEFORE INSERT OR UPDATE ON public.organization_invites
FOR EACH ROW
EXECUTE FUNCTION public.sync_multitenant_scope_fields();

CREATE OR REPLACE FUNCTION public.prevent_duplicate_memberships()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  effective_org_id UUID;
BEGIN
  effective_org_id := COALESCE(NEW.organization_id, NEW.org_id);

  IF effective_org_id IS NULL THEN
    RAISE EXCEPTION 'organization_id or org_id is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = NEW.user_id
      AND COALESCE(m.organization_id, m.org_id) = effective_org_id
      AND COALESCE(m.status, 'active') <> 'removed'
      AND (TG_OP = 'INSERT' OR m.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'Usuario ja e membro desta organizacao';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memberships_prevent_duplicates ON public.memberships;
CREATE TRIGGER trg_memberships_prevent_duplicates
BEFORE INSERT OR UPDATE ON public.memberships
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_memberships();

CREATE OR REPLACE FUNCTION public.prevent_duplicate_invites()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  effective_org_id UUID;
BEGIN
  effective_org_id := COALESCE(NEW.organization_id, NEW.org_id);

  IF effective_org_id IS NULL THEN
    RAISE EXCEPTION 'organization_id or org_id is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_invites i
    WHERE lower(i.email) = lower(NEW.email)
      AND COALESCE(i.organization_id, i.org_id) = effective_org_id
      AND COALESCE(i.status, 'pending') = 'pending'
      AND (TG_OP = 'INSERT' OR i.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'Ja existe um convite pendente para este email';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organization_invites_prevent_duplicates ON public.organization_invites;
CREATE TRIGGER trg_organization_invites_prevent_duplicates
BEFORE INSERT OR UPDATE ON public.organization_invites
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_invites();

-- ----------------------------------------------------------------------------
-- Access helpers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_master(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.master_users mu
    WHERE mu.user_id = p_user_id
      AND COALESCE(mu.is_active, TRUE) = TRUE
  )
  OR EXISTS (
    SELECT 1
    FROM public.memberships m
    LEFT JOIN public.user_roles ur ON ur.id = m.role_id
    WHERE m.user_id = p_user_id
      AND COALESCE(m.status, 'active') <> 'removed'
      AND lower(COALESCE(ur.name, m.role, '')) = 'master'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_platform_super_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.super_admins sa
    WHERE sa.user_id = p_user_id
      AND COALESCE(sa.is_active, TRUE) = TRUE
  )
  OR EXISTS (
    SELECT 1
    FROM public.memberships m
    LEFT JOIN public.user_roles ur ON ur.id = m.role_id
    WHERE m.user_id = p_user_id
      AND COALESCE(m.status, 'active') <> 'removed'
      AND lower(COALESCE(ur.name, m.role, '')) IN ('super_user', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_admin_access(p_user_id UUID, p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.is_platform_master(p_user_id)
  OR public.is_platform_super_user(p_user_id)
  OR EXISTS (
    SELECT 1
    FROM public.memberships m
    LEFT JOIN public.user_roles ur ON ur.id = m.role_id
    WHERE m.user_id = p_user_id
      AND COALESCE(m.organization_id, m.org_id) = p_organization_id
      AND COALESCE(m.status, 'active') <> 'removed'
      AND lower(COALESCE(ur.name, m.role, '')) IN ('org_admin', 'admin', 'owner')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_member_access(p_user_id UUID, p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.is_platform_master(p_user_id)
  OR public.is_platform_super_user(p_user_id)
  OR EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = p_user_id
      AND COALESCE(m.organization_id, m.org_id) = p_organization_id
      AND COALESCE(m.status, 'active') <> 'removed'
  );
$$;

-- ----------------------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mt_organizations_select ON public.organizations;
CREATE POLICY mt_organizations_select
ON public.organizations
FOR SELECT
TO authenticated
USING (
  public.is_platform_master(auth.uid())
  OR public.is_platform_super_user(auth.uid())
  OR public.has_org_member_access(auth.uid(), id)
);

DROP POLICY IF EXISTS mt_organizations_insert ON public.organizations;
CREATE POLICY mt_organizations_insert
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_platform_master(auth.uid())
  OR public.is_platform_super_user(auth.uid())
);

DROP POLICY IF EXISTS mt_organizations_update ON public.organizations;
CREATE POLICY mt_organizations_update
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  public.has_org_admin_access(auth.uid(), id)
)
WITH CHECK (
  public.has_org_admin_access(auth.uid(), id)
);

DROP POLICY IF EXISTS mt_organizations_delete ON public.organizations;
CREATE POLICY mt_organizations_delete
ON public.organizations
FOR DELETE
TO authenticated
USING (
  public.has_org_admin_access(auth.uid(), id)
);

DROP POLICY IF EXISTS mt_memberships_select ON public.memberships;
CREATE POLICY mt_memberships_select
ON public.memberships
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_org_admin_access(auth.uid(), COALESCE(organization_id, org_id))
);

DROP POLICY IF EXISTS mt_memberships_insert ON public.memberships;
CREATE POLICY mt_memberships_insert
ON public.memberships
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_org_admin_access(auth.uid(), COALESCE(organization_id, org_id))
);

DROP POLICY IF EXISTS mt_memberships_update ON public.memberships;
CREATE POLICY mt_memberships_update
ON public.memberships
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_org_admin_access(auth.uid(), COALESCE(organization_id, org_id))
)
WITH CHECK (
  user_id = auth.uid()
  OR public.has_org_admin_access(auth.uid(), COALESCE(organization_id, org_id))
);

DROP POLICY IF EXISTS mt_memberships_delete ON public.memberships;
CREATE POLICY mt_memberships_delete
ON public.memberships
FOR DELETE
TO authenticated
USING (
  public.has_org_admin_access(auth.uid(), COALESCE(organization_id, org_id))
);

DROP POLICY IF EXISTS mt_invites_select ON public.organization_invites;
CREATE POLICY mt_invites_select
ON public.organization_invites
FOR SELECT
TO authenticated
USING (
  public.has_org_admin_access(auth.uid(), COALESCE(organization_id, org_id))
);

DROP POLICY IF EXISTS mt_invites_insert ON public.organization_invites;
CREATE POLICY mt_invites_insert
ON public.organization_invites
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_org_admin_access(auth.uid(), COALESCE(organization_id, org_id))
);

DROP POLICY IF EXISTS mt_invites_update ON public.organization_invites;
CREATE POLICY mt_invites_update
ON public.organization_invites
FOR UPDATE
TO authenticated
USING (
  public.has_org_admin_access(auth.uid(), COALESCE(organization_id, org_id))
)
WITH CHECK (
  public.has_org_admin_access(auth.uid(), COALESCE(organization_id, org_id))
);

DROP POLICY IF EXISTS mt_invites_delete ON public.organization_invites;
CREATE POLICY mt_invites_delete
ON public.organization_invites
FOR DELETE
TO authenticated
USING (
  public.has_org_admin_access(auth.uid(), COALESCE(organization_id, org_id))
);

DROP POLICY IF EXISTS mt_user_roles_select ON public.user_roles;
CREATE POLICY mt_user_roles_select
ON public.user_roles
FOR SELECT
TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS mt_user_roles_write ON public.user_roles;
CREATE POLICY mt_user_roles_write
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.is_platform_master(auth.uid())
  OR public.is_platform_super_user(auth.uid())
)
WITH CHECK (
  public.is_platform_master(auth.uid())
  OR public.is_platform_super_user(auth.uid())
);

DROP POLICY IF EXISTS mt_master_users_all ON public.master_users;
CREATE POLICY mt_master_users_all
ON public.master_users
FOR ALL
TO authenticated
USING (
  public.is_platform_master(auth.uid())
)
WITH CHECK (
  public.is_platform_master(auth.uid())
);

DROP POLICY IF EXISTS mt_super_admins_all ON public.super_admins;
CREATE POLICY mt_super_admins_all
ON public.super_admins
FOR ALL
TO authenticated
USING (
  public.is_platform_master(auth.uid())
  OR public.is_platform_super_user(auth.uid())
)
WITH CHECK (
  public.is_platform_master(auth.uid())
  OR public.is_platform_super_user(auth.uid())
);

-- ----------------------------------------------------------------------------
-- RPC helpers used by the current app
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_org_and_add_admin()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  INSERT INTO public.organizations (
    name,
    is_active,
    subscription_plan,
    subscription_status
  )
  VALUES (
    'Minha Organizacao',
    TRUE,
    'free',
    'active'
  )
  RETURNING id INTO v_org_id;

  INSERT INTO public.memberships (
    user_id,
    organization_id,
    org_id,
    role,
    status,
    accepted_at
  )
  VALUES (
    v_user_id,
    v_org_id,
    v_org_id,
    'org_admin',
    'active',
    NOW()
  );

  RETURN v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_user_to_org(
  p_org_id UUID,
  p_email TEXT,
  p_role_name TEXT,
  p_invited_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_requester UUID := auth.uid();
  v_effective_org_id UUID := p_org_id;
  v_role_name TEXT := COALESCE(NULLIF(trim(p_role_name), ''), 'org_user');
  v_role_id UUID;
  v_invite_id UUID;
  v_target_user_id UUID;
  v_email TEXT := lower(trim(p_email));
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF v_effective_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required';
  END IF;

  IF NOT public.has_org_admin_access(v_requester, v_effective_org_id) THEN
    RAISE EXCEPTION 'Sem permissao';
  END IF;

  SELECT ur.id
    INTO v_role_id
  FROM public.user_roles ur
  WHERE lower(ur.name) = lower(v_role_name)
  LIMIT 1;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role nao encontrada';
  END IF;

  SELECT u.id
    INTO v_target_user_id
  FROM auth.users u
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_target_user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = v_target_user_id
      AND COALESCE(m.organization_id, m.org_id) = v_effective_org_id
      AND COALESCE(m.status, 'active') <> 'removed'
  ) THEN
    RAISE EXCEPTION 'Usuario ja e membro desta organizacao';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_invites i
    WHERE lower(i.email) = v_email
      AND COALESCE(i.organization_id, i.org_id) = v_effective_org_id
      AND COALESCE(i.status, 'pending') = 'pending'
      AND COALESCE(i.expires_at, NOW() + INTERVAL '1 second') > NOW()
  ) THEN
    RAISE EXCEPTION 'Ja existe um convite pendente para este email';
  END IF;

  INSERT INTO public.organization_invites (
    organization_id,
    org_id,
    email,
    token,
    role,
    role_id,
    invited_by,
    status,
    expires_at
  )
  VALUES (
    v_effective_org_id,
    v_effective_org_id,
    v_email,
    gen_random_uuid()::text,
    v_role_name,
    v_role_id,
    v_requester,
    'pending',
    NOW() + INTERVAL '7 days'
  )
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_invite(
  p_token TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', current_setting('request.jwt.claim.email', TRUE)));
  v_invite RECORD;
  v_membership_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  SELECT *
    INTO v_invite
  FROM public.organization_invites
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite invalido ou expirado';
  END IF;

  IF COALESCE(v_invite.status, 'pending') <> 'pending' OR COALESCE(v_invite.expires_at, NOW()) < NOW() THEN
    RAISE EXCEPTION 'Convite invalido ou expirado';
  END IF;

  IF lower(v_invite.email) <> v_user_email THEN
    RAISE EXCEPTION 'Email do usuario nao confere';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = v_user_id
      AND COALESCE(m.organization_id, m.org_id) = COALESCE(v_invite.organization_id, v_invite.org_id)
      AND COALESCE(m.status, 'active') <> 'removed'
  ) THEN
    RAISE EXCEPTION 'Usuario ja e membro desta organizacao';
  END IF;

  INSERT INTO public.memberships (
    user_id,
    organization_id,
    org_id,
    role,
    role_id,
    status,
    invited_at,
    accepted_at
  )
  VALUES (
    v_user_id,
    COALESCE(v_invite.organization_id, v_invite.org_id),
    COALESCE(v_invite.organization_id, v_invite.org_id),
    v_invite.role,
    v_invite.role_id,
    'active',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_membership_id;

  UPDATE public.organization_invites
  SET status = 'accepted',
      accepted_at = NOW(),
      accepted_by = v_user_id
  WHERE id = v_invite.id;

  RETURN v_membership_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_org_and_add_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_user_to_org(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(TEXT) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invites TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.super_admins TO authenticated;

-- ============================================================================
-- End of migration
-- ============================================================================
