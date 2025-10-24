-- Fix RLS policy for organizations to allow super_admin to update

-- Drop existing policies
DROP POLICY IF EXISTS "Users can update their own organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their own organizations" ON organizations;

-- Create new policy that allows both admin and super_admin to update
CREATE POLICY "Users can update their own organizations" ON organizations
    FOR UPDATE USING (
        id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

-- Allow users to view organizations they belong to
CREATE POLICY "Users can view their own organizations" ON organizations
    FOR SELECT USING (
        id IN (
            SELECT org_id FROM memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Allow super_admin to insert organizations
CREATE POLICY "Super admin can insert organizations" ON organizations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM memberships 
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Allow super_admin to delete organizations
CREATE POLICY "Super admin can delete organizations" ON organizations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM memberships 
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );