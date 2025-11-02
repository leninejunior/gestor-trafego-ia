-- Fix organization_memberships view
-- This creates a view that maps the expected API interface to the actual database structure

-- Create a view that provides client_id access based on organization membership
CREATE OR REPLACE VIEW organization_memberships AS
SELECT 
  m.id,
  m.user_id,
  c.id as client_id,
  m.org_id as organization_id,
  m.role,
  m.created_at,
  m.updated_at
FROM memberships m
INNER JOIN clients c ON c.org_id = m.org_id;

-- Grant access to the view
GRANT SELECT ON organization_memberships TO authenticated;

-- Create RLS policy for the view
ALTER VIEW organization_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own memberships" ON organization_memberships
  FOR SELECT USING (user_id = auth.uid());