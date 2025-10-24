-- =============================================
-- FIX SUBSCRIPTION PLANS RLS POLICIES
-- =============================================
-- Este script corrige as políticas RLS para permitir que admins
-- editem planos de assinatura

-- Drop existing policies
DROP POLICY IF EXISTS "Planos são públicos para leitura" ON subscription_plans;
DROP POLICY IF EXISTS "Apenas super admin pode modificar planos" ON subscription_plans;
DROP POLICY IF EXISTS "subscription_plans_public_read" ON subscription_plans;
DROP POLICY IF EXISTS "subscription_plans_admin_all" ON subscription_plans;

-- Create new policies
-- 1. Public read access to active plans
CREATE POLICY "subscription_plans_public_read" 
ON subscription_plans
FOR SELECT 
USING (is_active = true);

-- 2. Admin full access (checks both admin_users and memberships tables)
CREATE POLICY "subscription_plans_admin_all" 
ON subscription_plans
FOR ALL 
USING (
    -- Check if user is in admin_users table
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE user_id = auth.uid()
        AND is_active = true
    )
    OR
    -- Check if user is super_admin in memberships table
    EXISTS (
        SELECT 1 FROM memberships m 
        WHERE m.user_id = auth.uid() 
        AND m.role = 'super_admin'
    )
);

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
WHERE tablename = 'subscription_plans'
ORDER BY policyname;
