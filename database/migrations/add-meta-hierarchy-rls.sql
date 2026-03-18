-- Adicionar políticas RLS para tabelas de hierarquia Meta

-- ============================================
-- TABELA: meta_adsets
-- ============================================

-- Habilitar RLS
ALTER TABLE meta_adsets ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "meta_adsets_select" ON meta_adsets;
DROP POLICY IF EXISTS "meta_adsets_insert" ON meta_adsets;
DROP POLICY IF EXISTS "meta_adsets_update" ON meta_adsets;
DROP POLICY IF EXISTS "meta_adsets_delete" ON meta_adsets;
DROP POLICY IF EXISTS "service_role_full_access_meta_adsets" ON meta_adsets;

-- SELECT: Usuários veem apenas adsets de seus clientes
CREATE POLICY "meta_adsets_select"
  ON meta_adsets
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

-- INSERT: Usuários podem inserir adsets para seus clientes
CREATE POLICY "meta_adsets_insert"
  ON meta_adsets
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

-- UPDATE: Usuários podem atualizar adsets de seus clientes
CREATE POLICY "meta_adsets_update"
  ON meta_adsets
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

-- DELETE: Usuários podem deletar adsets de seus clientes
CREATE POLICY "meta_adsets_delete"
  ON meta_adsets
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
CREATE POLICY "service_role_full_access_meta_adsets"
  ON meta_adsets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- TABELA: meta_ads
-- ============================================

-- Habilitar RLS
ALTER TABLE meta_ads ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "meta_ads_select" ON meta_ads;
DROP POLICY IF EXISTS "meta_ads_insert" ON meta_ads;
DROP POLICY IF EXISTS "meta_ads_update" ON meta_ads;
DROP POLICY IF EXISTS "meta_ads_delete" ON meta_ads;
DROP POLICY IF EXISTS "service_role_full_access_meta_ads" ON meta_ads;

-- SELECT: Usuários veem apenas ads de seus clientes
CREATE POLICY "meta_ads_select"
  ON meta_ads
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

-- INSERT: Usuários podem inserir ads para seus clientes
CREATE POLICY "meta_ads_insert"
  ON meta_ads
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

-- UPDATE: Usuários podem atualizar ads de seus clientes
CREATE POLICY "meta_ads_update"
  ON meta_ads
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

-- DELETE: Usuários podem deletar ads de seus clientes
CREATE POLICY "meta_ads_delete"
  ON meta_ads
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
CREATE POLICY "service_role_full_access_meta_ads"
  ON meta_ads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- TABELA: meta_adset_insights
-- ============================================

-- Habilitar RLS
ALTER TABLE meta_adset_insights ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "meta_adset_insights_select" ON meta_adset_insights;
DROP POLICY IF EXISTS "meta_adset_insights_insert" ON meta_adset_insights;
DROP POLICY IF EXISTS "service_role_full_access_meta_adset_insights" ON meta_adset_insights;

-- SELECT: Usuários veem apenas insights de seus clientes
CREATE POLICY "meta_adset_insights_select"
  ON meta_adset_insights
  FOR SELECT
  TO authenticated
  USING (
    adset_id IN (
      SELECT ma.id
      FROM meta_adsets ma
      JOIN client_meta_connections cmc ON cmc.id = ma.connection_id
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- INSERT: Usuários podem inserir insights para seus clientes
CREATE POLICY "meta_adset_insights_insert"
  ON meta_adset_insights
  FOR INSERT
  TO authenticated
  WITH CHECK (
    adset_id IN (
      SELECT ma.id
      FROM meta_adsets ma
      JOIN client_meta_connections cmc ON cmc.id = ma.connection_id
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Service role tem acesso total
CREATE POLICY "service_role_full_access_meta_adset_insights"
  ON meta_adset_insights
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- TABELA: meta_ad_insights
-- ============================================

-- Habilitar RLS
ALTER TABLE meta_ad_insights ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "meta_ad_insights_select" ON meta_ad_insights;
DROP POLICY IF EXISTS "meta_ad_insights_insert" ON meta_ad_insights;
DROP POLICY IF EXISTS "service_role_full_access_meta_ad_insights" ON meta_ad_insights;

-- SELECT: Usuários veem apenas insights de seus clientes
CREATE POLICY "meta_ad_insights_select"
  ON meta_ad_insights
  FOR SELECT
  TO authenticated
  USING (
    ad_id IN (
      SELECT ma.id
      FROM meta_ads ma
      JOIN client_meta_connections cmc ON cmc.id = ma.connection_id
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- INSERT: Usuários podem inserir insights para seus clientes
CREATE POLICY "meta_ad_insights_insert"
  ON meta_ad_insights
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ad_id IN (
      SELECT ma.id
      FROM meta_ads ma
      JOIN client_meta_connections cmc ON cmc.id = ma.connection_id
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Service role tem acesso total
CREATE POLICY "service_role_full_access_meta_ad_insights"
  ON meta_ad_insights
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
WHERE tablename IN ('meta_adsets', 'meta_ads', 'meta_adset_insights', 'meta_ad_insights')
ORDER BY tablename, policyname;
