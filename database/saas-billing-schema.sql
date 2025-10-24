-- Schema completo para sistema SaaS com Stripe
-- Executar no Supabase SQL Editor

-- 1. Tabela de planos de produto
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2) NOT NULL,
  stripe_price_id_monthly VARCHAR(255),
  stripe_price_id_yearly VARCHAR(255),
  stripe_product_id VARCHAR(255),
  features JSONB DEFAULT '[]',
  max_clients INTEGER DEFAULT 5,
  max_campaigns INTEGER DEFAULT 10,
  max_users INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de assinaturas
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_customer_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active', -- active, canceled, past_due, unpaid
  billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de faturas
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_invoice_id VARCHAR(255) UNIQUE,
  invoice_number VARCHAR(100),
  amount_total DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'BRL',
  status VARCHAR(50) DEFAULT 'draft', -- draft, open, paid, void, uncollectible
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  invoice_pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de pagamentos
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
  stripe_payment_intent_id VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'BRL',
  status VARCHAR(50) DEFAULT 'pending', -- pending, succeeded, failed, canceled
  payment_method VARCHAR(100),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Inserir planos padrão
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, features, max_clients, max_campaigns, max_users) VALUES
('Modo Acesso', 'Para quem está começando', 99.00, 990.00, 
 '["Até 5 contas de anúncios", "6 meses de histórico", "15 créditos de IA mensais", "Acesso a todas as funcionalidades"]', 
 5, 10, 3),
('Modo Expansão', 'Para agências em crescimento', 129.00, 1290.00,
 '["Até 10 contas de anúncios", "12 meses de histórico", "30 créditos de IA mensais", "Acesso a todas as funcionalidades"]',
 10, 25, 5),
('Modo Ascensão', 'Para agências estabelecidas', 199.00, 1990.00,
 '["Até 30 contas de anúncios", "24 meses de histórico", "60 créditos de IA mensais", "Acesso a todas as funcionalidades"]',
 30, 50, 10),
('Modo Dominação', 'Para grandes operações', 299.00, 2990.00,
 '["Até 60 contas de anúncios", "48 meses de histórico", "100 créditos de IA mensais", "Acesso a todas as funcionalidades"]',
 60, 100, 15),
('Modo Império', 'Para quem não tem limites', 449.00, 4490.00,
 '["Até 100 contas de anúncios", "60 meses de histórico", "300 créditos de IA mensais", "Acesso a todas as funcionalidades"]',
 100, 200, 25);

-- 6. RLS Policies
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Políticas para planos (público para leitura)
CREATE POLICY "Planos são públicos para leitura" ON subscription_plans FOR SELECT USING (true);
CREATE POLICY "Apenas super admin pode modificar planos" ON subscription_plans FOR ALL USING (
  EXISTS (
    SELECT 1 FROM memberships m 
    WHERE m.user_id = auth.uid() 
    AND m.role = 'super_admin'
  )
);

-- Políticas para assinaturas
CREATE POLICY "Usuários podem ver assinaturas da sua organização" ON subscriptions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships m 
    WHERE m.user_id = auth.uid() 
    AND m.org_id = organization_id
  )
);

CREATE POLICY "Super admin pode ver todas as assinaturas" ON subscriptions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships m 
    WHERE m.user_id = auth.uid() 
    AND m.role = 'super_admin'
  )
);

-- Políticas para faturas
CREATE POLICY "Usuários podem ver faturas da sua organização" ON invoices FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships m 
    WHERE m.user_id = auth.uid() 
    AND m.org_id = organization_id
  )
);

CREATE POLICY "Super admin pode ver todas as faturas" ON invoices FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships m 
    WHERE m.user_id = auth.uid() 
    AND m.role = 'super_admin'
  )
);

-- Políticas para pagamentos
CREATE POLICY "Usuários podem ver pagamentos da sua organização" ON payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships m 
    WHERE m.user_id = auth.uid() 
    AND m.org_id = organization_id
  )
);

CREATE POLICY "Super admin pode ver todos os pagamentos" ON payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM memberships m 
    WHERE m.user_id = auth.uid() 
    AND m.role = 'super_admin'
  )
);

-- 7. Funções úteis
CREATE OR REPLACE FUNCTION get_organization_subscription(org_id UUID)
RETURNS TABLE (
  subscription_id UUID,
  plan_name VARCHAR,
  status VARCHAR,
  current_period_end TIMESTAMP WITH TIME ZONE,
  max_clients INTEGER,
  max_campaigns INTEGER,
  max_users INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    sp.name,
    s.status,
    s.current_period_end,
    sp.max_clients,
    sp.max_campaigns,
    sp.max_users
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.organization_id = org_id
  AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();