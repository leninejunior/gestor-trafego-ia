-- =============================================
-- FIX ADMIN_USERS RLS INFINITE RECURSION
-- =============================================
-- Este script corrige a recursão infinita nas políticas RLS da tabela admin_users

-- Drop all existing policies on admin_users
DROP POLICY IF EXISTS "admin_users_select_policy" ON admin_users;
DROP POLICY IF EXISTS "admin_users_insert_policy" ON admin_users;
DROP POLICY IF EXISTS "admin_users_update_policy" ON admin_users;
DROP POLICY IF EXISTS "admin_users_delete_policy" ON admin_users;
DROP POLICY IF EXISTS "Users can view their own admin status" ON admin_users;
DROP POLICY IF EXISTS "Only admins can modify admin_users" ON admin_users;
DROP POLICY IF EXISTS "Admins can manage admin users" ON admin_users;

-- Disable RLS temporarily to avoid recursion
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
-- Policy 1: Users can view their own admin status (no recursion)
CREATE POLICY "admin_users_view_own" 
ON admin_users
FOR SELECT 
USING (user_id = auth.uid());

-- Policy 2: Service role can do everything (bypasses RLS anyway)
-- This is just for clarity
CREATE POLICY "admin_users_service_role" 
ON admin_users
FOR ALL 
USING (auth.jwt()->>'role' = 'service_role');

-- Verify policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'admin_users'
ORDER BY policyname;

-- Test: Check if current user can see their admin status
SELECT 
    user_id,
    is_admin,
    is_active,
    created_at
FROM admin_users
WHERE user_id = auth.uid();
