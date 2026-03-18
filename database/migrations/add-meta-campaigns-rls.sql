-- Adicionar políticas RLS para meta_campaigns
-- Esta tabela estava sem políticas, bloqueando todo acesso!

-- ============================================
-- TABELA: meta_campaigns
-- ============================================

-- Habilitar RLS (já deve estar habilitado, mas garantir)
ALTER TABLE meta_campaigns ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "meta_campaigns_select" ON meta_campaigns;
DROP POLICY IF EXISTS "meta_campaigns_insert" ON meta_campaigns;
DROP POLICY IF EXISTS "meta_campaigns_update" ON meta_campaigns;
DROP POLICY IF EXISTS "meta_campaigns_delete" ON meta_campaigns;
DROP POLICY IF EXISTS "service_role_full_access_meta_campaigns" ON meta_campaigns;

-- SELECT: Usuários veem apenas campanhas de seus clientes
CREATE POLICY "meta_campaigns_select"
  ON meta_campaigns
  FOR SELECT
  TO authenticated
  USING (
    connection_id IN (
      SELECT cmc.id
      FROM client_meta_connections cmc
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- INSERT: Usuários podem inserir campanhas para seus clientes
CREATE POLICY "meta_campaigns_insert"
  ON meta_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    connection_id IN (
      SELECT cmc.id
      FROM client_meta_connections cmc
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- UPDATE: Usuários podem atualizar campanhas de seus clientes
CREATE POLICY "meta_campaigns_update"
  ON meta_campaigns
  FOR UPDATE
  TO authenticated
  USING (
    connection_id IN (
      SELECT cmc.id
      FROM client_meta_connections cmc
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    connection_id IN (
      SELECT cmc.id
      FROM client_meta_connections cmc
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- DELETE: Usuários podem deletar campanhas de seus clientes
CREATE POLICY "meta_campaigns_delete"
  ON meta_campaigns
  FOR DELETE
  TO authenticated
  USING (
    connection_id IN (
      SELECT cmc.id
      FROM client_meta_connections cmc
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Service role tem acesso total
CREATE POLICY "service_role_full_access_meta_campaigns"
  ON meta_campaigns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- TABELA: meta_campaign_insights
-- ============================================

-- Habilitar RLS
ALTER TABLE meta_campaign_insights ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "meta_campaign_insights_select" ON meta_campaign_insights;
DROP POLICY IF EXISTS "meta_campaign_insights_insert" ON meta_campaign_insights;
DROP POLICY IF EXISTS "service_role_full_access_meta_campaign_insights" ON meta_campaign_insights;

-- SELECT: Usuários veem apenas insights de seus clientes
CREATE POLICY "meta_campaign_insights_select"
  ON meta_campaign_insights
  FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT mc.id
      FROM meta_campaigns mc
      JOIN client_meta_connections cmc ON cmc.id = mc.connection_id
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- INSERT: Usuários podem inserir insights para seus clientes
CREATE POLICY "meta_campaign_insights_insert"
  ON meta_campaign_insights
  FOR INSERT
  TO authenticated
  WITH CHECK (
    campaign_id IN (
      SELECT mc.id
      FROM meta_campaigns mc
      JOIN client_meta_connections cmc ON cmc.id = mc.connection_id
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Service role tem acesso total
CREATE POLICY "service_role_full_access_meta_campaign_insights"
  ON meta_campaign_insights
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar políticas criadas
SELECT 
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename IN ('meta_campaigns', 'meta_campaign_insights')
ORDER BY tablename, policyname;
