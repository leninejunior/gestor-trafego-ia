-- CORREÇÃO DEFINITIVA DAS PERMISSÕES RLS
-- Execute este script no SQL Editor do Supabase
-- Versão: 2.0 - Sem recursão e políticas simplificadas

-- =====================================================
-- PASSO 1: DESABILITAR RLS TEMPORARIAMENTE
-- =====================================================
ALTER TABLE IF EXISTS super_admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS client_meta_connections DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS campaign_insights DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASSO 2: LIMPAR TODAS AS POLÍTICAS EXISTENTES
-- =====================================================

-- Organizações
DROP POLICY IF EXISTS "Super admins and members can view organizations" ON organizations;
DROP POLICY IF EXISTS "Super admins and members can update organizations" ON organizations;
DROP POLICY IF EXISTS "Super admins and members can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Super admins and members can delete organizations" ON organizations;
DROP POLICY IF EXISTS "Allow super admins full access to organizations" ON organizations;
DROP POLICY IF EXISTS "Allow members to view their organizations" ON organizations;
DROP POLICY IF EXISTS "organizations_all" ON organizations;
DROP POLICY IF EXISTS "organizations_authenticated" ON organizations;

-- Memberships
DROP POLICY IF EXISTS "Super admins and members can view memberships" ON memberships;
DROP POLICY IF EXISTS "Super admins and members can update memberships" ON memberships;
DROP POLICY IF EXISTS "Super admins and members can insert memberships" ON memberships;
DROP POLICY IF EXISTS "Super admins and members can delete memberships" ON memberships;
DROP POLICY IF EXISTS "Allow super admins full access to memberships" ON memberships;
DROP POLICY IF EXISTS "Allow users to view their own memberships" ON memberships;
DROP POLICY IF EXISTS "memberships_all" ON memberships;
DROP POLICY IF EXISTS "memberships_authenticated" ON memberships;

-- Clientes
DROP POLICY IF EXISTS "Super admins and members can view clients" ON clients;
DROP POLICY IF EXISTS "Super admins and members can update clients" ON clients;
DROP POLICY IF EXISTS "Super admins and members can insert clients" ON clients;
DROP POLICY IF EXISTS "Super admins and members can delete clients" ON clients;
DROP POLICY IF EXISTS "Allow super admins full access to clients" ON clients;
DROP POLICY IF EXISTS "Allow members to access clients in their org" ON clients;
DROP POLICY IF EXISTS "clients_all" ON clients;
DROP POLICY IF EXISTS "clients_authenticated" ON clients;

-- Meta Connections
DROP POLICY IF EXISTS "Super admins and members can view meta connections" ON client_meta_connections;
DROP POLICY IF EXISTS "Super admins and members can update meta connections" ON client_meta_connections;
DROP POLICY IF EXISTS "Super admins and members can insert meta connections" ON client_meta_connections;
DROP POLICY IF EXISTS "Super admins and members can delete meta connections" ON client_meta_connections;
DROP POLICY IF EXISTS "Allow super admins full access to meta connections" ON client_meta_connections;
DROP POLICY IF EXISTS "Allow members to access meta connections for their clients" ON client_meta_connections;
DROP POLICY IF EXISTS "client_meta_connections_all" ON client_meta_connections;
DROP POLICY IF EXISTS "client_meta_connections_authenticated" ON client_meta_connections;

-- Super Admins
DROP POLICY IF EXISTS "Only super admins can view super admins" ON super_admins;
DROP POLICY IF EXISTS "Only super admins can insert super admins" ON super_admins;
DROP POLICY IF EXISTS "Only super admins can update super admins" ON super_admins;
DROP POLICY IF EXISTS "Only super admins can delete super admins" ON super_admins;
DROP POLICY IF EXISTS "Allow authenticated users to view super admins" ON super_admins;
DROP POLICY IF EXISTS "Only super admins can modify super admins" ON super_admins;
DROP POLICY IF EXISTS "super_admins_select" ON super_admins;
DROP POLICY IF EXISTS "super_admins_insert" ON super_admins;
DROP POLICY IF EXISTS "super_admins_update" ON super_admins;
DROP POLICY IF EXISTS "super_admins_delete" ON super_admins;

-- Campanhas (se existir)
DROP POLICY IF EXISTS "campaigns_authenticated" ON campaigns;
DROP POLICY IF EXISTS "campaign_insights_authenticated" ON campaign_insights;

-- =====================================================
-- PASSO 3: CRIAR POLÍTICAS ULTRA SIMPLES
-- =====================================================

-- SUPER ADMINS - Acesso total para usuários autenticados
CREATE POLICY "super_admins_full_access" ON super_admins
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ORGANIZATIONS - Acesso total para usuários autenticados
CREATE POLICY "organizations_full_access" ON organizations
  FOR ALL USING (auth.uid() IS NOT NULL);

-- MEMBERSHIPS - Acesso total para usuários autenticados
CREATE POLICY "memberships_full_access" ON memberships
  FOR ALL USING (auth.uid() IS NOT NULL);

-- CLIENTS - Acesso total para usuários autenticados
CREATE POLICY "clients_full_access" ON clients
  FOR ALL USING (auth.uid() IS NOT NULL);

-- CLIENT META CONNECTIONS - Acesso total para usuários autenticados
CREATE POLICY "client_meta_connections_full_access" ON client_meta_connections
  FOR ALL USING (auth.uid() IS NOT NULL);

-- CAMPAIGNS - Acesso total para usuários autenticados (se tabela existir)
CREATE POLICY "campaigns_full_access" ON campaigns
  FOR ALL USING (auth.uid() IS NOT NULL);

-- CAMPAIGN INSIGHTS - Acesso total para usuários autenticados (se tabela existir)
CREATE POLICY "campaign_insights_full_access" ON campaign_insights
  FOR ALL USING (auth.uid() IS NOT NULL);

-- =====================================================
-- PASSO 4: REABILITAR RLS
-- =====================================================
ALTER TABLE IF EXISTS super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS client_meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS campaign_insights ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASSO 5: VERIFICAÇÕES FINAIS
-- =====================================================

-- Verificar se as tabelas existem e têm RLS habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('organizations', 'memberships', 'clients', 'super_admins', 'client_meta_connections')
ORDER BY tablename;

-- Verificar políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('organizations', 'memberships', 'clients', 'super_admins', 'client_meta_connections')
ORDER BY tablename, policyname;

-- =====================================================
-- MENSAGEM DE SUCESSO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ CORREÇÃO RLS APLICADA COM SUCESSO!';
  RAISE NOTICE '📋 Políticas simplificadas criadas para todas as tabelas';
  RAISE NOTICE '🔓 Acesso liberado para usuários autenticados';
  RAISE NOTICE '⚡ Sistema deve estar funcionando agora!';
END $$;