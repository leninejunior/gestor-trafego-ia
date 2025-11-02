-- Sistema de Super Administradores
-- Este script cria um sistema que permite super usuários terem acesso total ao sistema

-- 1. Criar tabela de super administradores
CREATE TABLE IF NOT EXISTS super_admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id)
);

-- 2. Função para verificar se um usuário é super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins 
    WHERE user_id = user_uuid AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Função para verificar se o usuário atual é super admin
CREATE OR REPLACE FUNCTION current_user_is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_super_admin(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Atualizar RLS policies para permitir acesso total aos super admins

-- Organizations - Super admins podem ver e modificar todas as organizações
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
DROP POLICY IF EXISTS "Users can update organizations they belong to" ON organizations;
DROP POLICY IF EXISTS "Users can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Users can delete organizations they belong to" ON organizations;

CREATE POLICY "Super admins and members can view organizations" ON organizations
  FOR SELECT USING (
    current_user_is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE memberships.org_id = organizations.id 
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins and members can update organizations" ON organizations
  FOR UPDATE USING (
    current_user_is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE memberships.org_id = organizations.id 
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins and authenticated users can insert organizations" ON organizations
  FOR INSERT WITH CHECK (
    current_user_is_super_admin() OR 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Super admins and members can delete organizations" ON organizations
  FOR DELETE USING (
    current_user_is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE memberships.org_id = organizations.id 
      AND memberships.user_id = auth.uid()
    )
  );

-- Memberships - Super admins podem ver e modificar todos os memberships
DROP POLICY IF EXISTS "Users can view memberships for their organizations" ON memberships;
DROP POLICY IF EXISTS "Users can update memberships for their organizations" ON memberships;
DROP POLICY IF EXISTS "Users can insert memberships for their organizations" ON memberships;
DROP POLICY IF EXISTS "Users can delete memberships for their organizations" ON memberships;

CREATE POLICY "Super admins and members can view memberships" ON memberships
  FOR SELECT USING (
    current_user_is_super_admin() OR 
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM memberships m2 
      WHERE m2.org_id = memberships.org_id 
      AND m2.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins and members can update memberships" ON memberships
  FOR UPDATE USING (
    current_user_is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM memberships m2 
      WHERE m2.org_id = memberships.org_id 
      AND m2.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins and members can insert memberships" ON memberships
  FOR INSERT WITH CHECK (
    current_user_is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM memberships m2 
      WHERE m2.org_id = memberships.org_id 
      AND m2.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins and members can delete memberships" ON memberships
  FOR DELETE USING (
    current_user_is_super_admin() OR 
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM memberships m2 
      WHERE m2.org_id = memberships.org_id 
      AND m2.user_id = auth.uid()
    )
  );

-- Clients - Super admins podem ver e modificar todos os clientes
DROP POLICY IF EXISTS "Users can view clients for their organizations" ON clients;
DROP POLICY IF EXISTS "Users can update clients for their organizations" ON clients;
DROP POLICY IF EXISTS "Users can insert clients for their organizations" ON clients;
DROP POLICY IF EXISTS "Users can delete clients for their organizations" ON clients;

CREATE POLICY "Super admins and members can view clients" ON clients
  FOR SELECT USING (
    current_user_is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE memberships.org_id = clients.org_id 
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins and members can update clients" ON clients
  FOR UPDATE USING (
    current_user_is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE memberships.org_id = clients.org_id 
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins and members can insert clients" ON clients
  FOR INSERT WITH CHECK (
    current_user_is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE memberships.org_id = clients.org_id 
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins and members can delete clients" ON clients
  FOR DELETE USING (
    current_user_is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE memberships.org_id = clients.org_id 
      AND memberships.user_id = auth.uid()
    )
  );

-- Client Meta Connections - Super admins podem ver e modificar todas as conexões
DROP POLICY IF EXISTS "Users can view meta connections for their clients" ON client_meta_connections;
DROP POLICY IF EXISTS "Users can update meta connections for their clients" ON client_meta_connections;
DROP POLICY IF EXISTS "Users can insert meta connections for their clients" ON client_meta_connections;
DROP POLICY IF EXISTS "Users can delete meta connections for their clients" ON client_meta_connections;

CREATE POLICY "Super admins and members can view meta connections" ON client_meta_connections
  FOR SELECT USING (
    current_user_is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM clients c
      JOIN memberships m ON m.org_id = c.org_id
      WHERE c.id = client_meta_connections.client_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins and members can update meta connections" ON client_meta_connections
  FOR UPDATE USING (
    current_user_is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM clients c
      JOIN memberships m ON m.org_id = c.org_id
      WHERE c.id = client_meta_connections.client_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins and members can insert meta connections" ON client_meta_connections
  FOR INSERT WITH CHECK (
    current_user_is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM clients c
      JOIN memberships m ON m.org_id = c.org_id
      WHERE c.id = client_meta_connections.client_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins and members can delete meta connections" ON client_meta_connections
  FOR DELETE USING (
    current_user_is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM clients c
      JOIN memberships m ON m.org_id = c.org_id
      WHERE c.id = client_meta_connections.client_id 
      AND m.user_id = auth.uid()
    )
  );

-- Habilitar RLS nas tabelas
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- RLS para super_admins table - apenas super admins podem ver e modificar
CREATE POLICY "Only super admins can view super admins" ON super_admins
  FOR SELECT USING (current_user_is_super_admin());

CREATE POLICY "Only super admins can insert super admins" ON super_admins
  FOR INSERT WITH CHECK (current_user_is_super_admin());

CREATE POLICY "Only super admins can update super admins" ON super_admins
  FOR UPDATE USING (current_user_is_super_admin());

CREATE POLICY "Only super admins can delete super admins" ON super_admins
  FOR DELETE USING (current_user_is_super_admin());

-- Função para adicionar super admin (pode ser chamada por qualquer super admin existente)
CREATE OR REPLACE FUNCTION add_super_admin(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar se o usuário atual é super admin ou se é o primeiro super admin sendo criado
  IF NOT current_user_is_super_admin() AND EXISTS (SELECT 1 FROM super_admins WHERE is_active = true) THEN
    RAISE EXCEPTION 'Only super admins can add new super admins';
  END IF;
  
  -- Inserir o novo super admin
  INSERT INTO super_admins (user_id, created_by)
  VALUES (target_user_id, auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET
    is_active = true,
    created_at = NOW();
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para remover super admin
CREATE OR REPLACE FUNCTION remove_super_admin(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar se o usuário atual é super admin
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can remove super admins';
  END IF;
  
  -- Não permitir que o último super admin se remova
  IF (SELECT COUNT(*) FROM super_admins WHERE is_active = true) <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last super admin';
  END IF;
  
  -- Remover o super admin
  UPDATE super_admins 
  SET is_active = false 
  WHERE user_id = target_user_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários para documentação
COMMENT ON TABLE super_admins IS 'Tabela que define quais usuários são super administradores com acesso total ao sistema';
COMMENT ON FUNCTION is_super_admin IS 'Verifica se um usuário específico é super administrador';
COMMENT ON FUNCTION current_user_is_super_admin IS 'Verifica se o usuário atual é super administrador';
COMMENT ON FUNCTION add_super_admin IS 'Adiciona um usuário como super administrador';
COMMENT ON FUNCTION remove_super_admin IS 'Remove um usuário da lista de super administradores';