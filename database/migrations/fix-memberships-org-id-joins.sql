-- ============================================================================
-- CORREÇÃO: Joins incorretos usando m.org_id ao invés de m.organization_id
-- ============================================================================
-- Problema: Algumas políticas RLS foram criadas usando m.org_id = c.org_id
-- Solução: Recriar políticas usando m.organization_id = c.org_id
-- Data: 2025-12-24
-- ============================================================================

-- Primeiro, remover políticas incorretas se existirem
DROP POLICY IF EXISTS "google_ads_connections_client_select" ON google_ads_connections;
DROP POLICY IF EXISTS "google_ads_connections_client_insert" ON google_ads_connections;
DROP POLICY IF EXISTS "google_ads_connections_client_update" ON google_ads_connections;
DROP POLICY IF EXISTS "google_ads_connections_client_delete" ON google_ads_connections;

DROP POLICY IF EXISTS "google_ads_campaigns_client_select" ON google_ads_campaigns;
DROP POLICY IF EXISTS "google_ads_campaigns_client_insert" ON google_ads_campaigns;
DROP POLICY IF EXISTS "google_ads_campaigns_client_update" ON google_ads_campaigns;
DROP POLICY IF EXISTS "google_ads_campaigns_client_delete" ON google_ads_campaigns;

DROP POLICY IF EXISTS "google_ads_audit_log_client_select" ON google_ads_audit_log;
DROP POLICY IF EXISTS "google_ads_audit_log_client_insert" ON google_ads_audit_log;

-- Recriar políticas com joins corretos
-- ============================================================================

-- Políticas para google_ads_connections
CREATE POLICY "google_ads_connections_client_select"
  ON google_ads_connections
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_ads_connections_client_insert"
  ON google_ads_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_ads_connections_client_update"
  ON google_ads_connections
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_ads_connections_client_delete"
  ON google_ads_connections
  FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Políticas para google_ads_campaigns
CREATE POLICY "google_ads_campaigns_client_select"
  ON google_ads_campaigns
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_ads_campaigns_client_insert"
  ON google_ads_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_ads_campaigns_client_update"
  ON google_ads_campaigns
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_ads_campaigns_client_delete"
  ON google_ads_campaigns
  FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Políticas para google_ads_audit_log
CREATE POLICY "google_ads_audit_log_client_select"
  ON google_ads_audit_log
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "google_ads_audit_log_client_insert"
  ON google_ads_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- VERIFICAÇÃO: Testar se as políticas estão funcionando
-- ============================================================================

-- Verificar se as políticas foram criadas corretamente
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('google_ads_connections', 'google_ads_campaigns', 'google_ads_audit_log')
ORDER BY tablename, policyname;

-- ============================================================================
-- INSTRUÇÕES DE APLICAÇÃO
-- ============================================================================
-- 1. Copie este SQL completo
-- 2. Cole no Supabase SQL Editor
-- 3. Execute
-- 4. Verifique se não há erros
-- 5. Teste a criação de clientes novamente
-- ============================================================================