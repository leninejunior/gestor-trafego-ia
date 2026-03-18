-- =============================================
-- Migration: User Client Access Table (Fixed)
-- Date: 2025-12-22
-- Description: Creates the correct tables as specified in the design document
-- =============================================

-- 1. Create super_admins table (as specified in design document)
CREATE TABLE IF NOT EXISTS super_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    UNIQUE(user_id)
);

-- 2. Create user_client_access table (as specified in design document)
CREATE TABLE IF NOT EXISTS user_client_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    granted_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{"read": true, "write": false}'::jsonb,
    notes TEXT,
    UNIQUE(user_id, client_id),
    -- Constraint: user e client devem pertencer à mesma org
    CONSTRAINT same_org_check CHECK (
        (SELECT org_id FROM clients WHERE id = client_id) = organization_id
    )
);

-- 3. Add role column to memberships if not exists
ALTER TABLE memberships 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'member';

-- 4. Enable RLS on new tables
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_client_access ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for super_admins
DROP POLICY IF EXISTS "super_admins_self_manage" ON super_admins;
CREATE POLICY "super_admins_self_manage"
  ON super_admins
  FOR ALL
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid() AND is_active = true)
  );

-- 6. RLS Policies for user_client_access
DROP POLICY IF EXISTS "user_client_access_self_read" ON user_client_access;
CREATE POLICY "user_client_access_self_read"
  ON user_client_access
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_client_access_admin_manage" ON user_client_access;
CREATE POLICY "user_client_access_admin_manage"
  ON user_client_access
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
      AND m.organization_id = user_client_access.organization_id
      AND m.role = 'admin'
    ) OR
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid() AND is_active = true)
  );

-- 7. Service role policies (for testing and admin operations)
DROP POLICY IF EXISTS "service_role_full_access_super_admins" ON super_admins;
CREATE POLICY "service_role_full_access_super_admins"
  ON super_admins
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_user_client_access" ON user_client_access;
CREATE POLICY "service_role_full_access_user_client_access"
  ON user_client_access
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_super_admins_user_id ON super_admins(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_client_access_user_id ON user_client_access(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_client_access_client_id ON user_client_access(client_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_client_access_organization_id ON user_client_access(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_client_access_granted_by ON user_client_access(granted_by);
CREATE INDEX IF NOT EXISTS idx_memberships_user_org ON memberships(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_role ON memberships(role) WHERE role = 'admin';

-- 9. Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_super_admins_updated_at ON super_admins;
CREATE TRIGGER update_super_admins_updated_at
    BEFORE UPDATE ON super_admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_client_access_updated_at ON user_client_access;
CREATE TRIGGER update_user_client_access_updated_at
    BEFORE UPDATE ON user_client_access
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Comments for documentation
COMMENT ON TABLE super_admins IS 'Super admin users with unlimited system access';
COMMENT ON TABLE user_client_access IS 'Granular client access control for common users';
COMMENT ON COLUMN user_client_access.permissions IS 'JSON object defining read/write permissions';
COMMENT ON CONSTRAINT same_org_check ON user_client_access IS 'Ensures user and client belong to same organization';

-- 11. Verification queries (commented out - uncomment to test)
-- SELECT 'super_admins table created' as status, count(*) as rows FROM super_admins;
-- SELECT 'user_client_access table created' as status, count(*) as rows FROM user_client_access;
-- SELECT 'memberships role column added' as status, column_name, data_type FROM information_schema.columns WHERE table_name = 'memberships' AND column_name = 'role';