# 🚀 Aplicar Schema de Pagamentos - AGORA

## 📋 **Instruções Simples**

### **Passo 1: Abrir Supabase**
1. Acesse [supabase.com](https://supabase.com)
2. Faça login na sua conta
3. Selecione seu projeto
4. Clique em **"SQL Editor"** no menu lateral

### **Passo 2: Executar o SQL**
1. Clique em **"New Query"**
2. Cole o SQL completo abaixo
3. Clique em **"Run"** (ou pressione Ctrl+Enter)

### **Passo 3: SQL para Executar**

```sql
-- Schema de Pagamentos para o Sistema Principal
-- Execute este script no SQL Editor do Supabase

-- ============================================================================
-- TABELAS DE PAGAMENTOS
-- ============================================================================

-- 1. Provedores de Pagamento (Stripe, Iugu, PagSeguro, Mercado Pago)
CREATE TABLE IF NOT EXISTS payment_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 'stripe', 'iugu', 'pagseguro', 'mercadopago'
  display_name TEXT NOT NULL, -- 'Stripe', 'Iugu', 'PagSeguro', 'Mercado Pago'
  is_active BOOLEAN DEFAULT true,
  is_sandbox BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1, -- Ordem de prioridade para failover
  
  -- Configurações específicas do provedor (criptografadas)
  config JSONB NOT NULL DEFAULT '{}', -- API keys, secrets, etc
  
  -- Métricas de performance
  success_rate DECIMAL(5,2) DEFAULT 100.00,
  avg_response_time INTEGER DEFAULT 0, -- em millisegundos
  last_health_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(org_id, name)
);

-- 2. Transações de Pagamento
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  provider_id UUID NOT NULL REFERENCES payment_providers(id) ON DELETE RESTRICT,
  
  -- Identificadores externos
  external_id TEXT, -- ID do provedor (Stripe payment_intent, etc)
  reference_id TEXT, -- Referência interna do cliente
  
  -- Dados do pagamento
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  description TEXT,
  
  -- Status da transação
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, succeeded, failed, canceled, refunded
  failure_reason TEXT,
  
  -- Dados do cliente/pagador
  customer_data JSONB DEFAULT '{}', -- nome, email, documento, etc
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps importantes
  processed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Assinaturas/Recorrências
CREATE TABLE IF NOT EXISTS payment_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  provider_id UUID NOT NULL REFERENCES payment_providers(id) ON DELETE RESTRICT,
  
  -- Identificadores externos
  external_id TEXT, -- ID do provedor
  
  -- Dados da assinatura
  plan_name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  interval_type TEXT NOT NULL, -- 'monthly', 'yearly', 'weekly'
  interval_count INTEGER DEFAULT 1,
  
  -- Status da assinatura
  status TEXT NOT NULL DEFAULT 'active', -- active, canceled, past_due, unpaid
  
  -- Dados do cliente
  customer_data JSONB DEFAULT '{}',
  
  -- Datas importantes
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Webhooks Recebidos
CREATE TABLE IF NOT EXISTS payment_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_id TEXT, -- ID único do evento no provedor
  
  -- Dados do webhook
  payload JSONB NOT NULL,
  headers JSONB DEFAULT '{}',
  
  -- Status do processamento
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Relacionamentos (podem ser nulos se não conseguir identificar)
  transaction_id UUID REFERENCES payment_transactions(id),
  subscription_id UUID REFERENCES payment_subscriptions(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Log de Auditoria de Pagamentos
CREATE TABLE IF NOT EXISTS payment_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Ação realizada
  action TEXT NOT NULL, -- 'create_payment', 'refund', 'cancel_subscription', etc
  entity_type TEXT NOT NULL, -- 'transaction', 'subscription', 'provider'
  entity_id UUID NOT NULL,
  
  -- Dados da ação
  old_data JSONB,
  new_data JSONB,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índices para payment_transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_org_id ON payment_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_client_id ON payment_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_id ON payment_transactions(provider_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_external_id ON payment_transactions(external_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);

-- Índices para payment_subscriptions
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_org_id ON payment_subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_client_id ON payment_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_provider_id ON payment_subscriptions(provider_id);
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_status ON payment_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_external_id ON payment_subscriptions(external_id);

-- Índices para payment_webhooks
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_provider_name ON payment_webhooks(provider_name);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_event_type ON payment_webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_processed ON payment_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_created_at ON payment_webhooks(created_at);

-- Índices para payment_audit_logs
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_org_id ON payment_audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_entity_type_id ON payment_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_created_at ON payment_audit_logs(created_at);

-- ============================================================================
-- RLS (ROW LEVEL SECURITY) POLICIES
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies para payment_providers
CREATE POLICY "Users can view payment providers from their organization" ON payment_providers
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage payment providers in their organization" ON payment_providers
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )
  );

-- Policies para payment_transactions
CREATE POLICY "Users can view transactions from their organization" ON payment_transactions
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage transactions in their organization" ON payment_transactions
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )
  );

-- Policies para payment_subscriptions
CREATE POLICY "Users can view subscriptions from their organization" ON payment_subscriptions
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage subscriptions in their organization" ON payment_subscriptions
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )
  );

-- Policies para payment_webhooks (apenas leitura para usuários)
CREATE POLICY "Users can view webhooks" ON payment_webhooks
  FOR SELECT USING (true); -- Webhooks podem ser visualizados por todos (dados não sensíveis)

-- Policies para payment_audit_logs
CREATE POLICY "Users can view audit logs from their organization" ON payment_audit_logs
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_payment_providers_updated_at BEFORE UPDATE ON payment_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_subscriptions_updated_at BEFORE UPDATE ON payment_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## ✅ **Verificação**

Após executar o SQL, você deve ver:
- ✅ 5 tabelas criadas
- ✅ Índices aplicados
- ✅ RLS policies ativadas
- ✅ Triggers configurados

## 🎉 **Próximos Passos**

Depois de aplicar o schema:
1. ✅ **Schema aplicado** ← Você está aqui
2. 🔄 **Criar APIs de pagamento**
3. 🎨 **Interface do dashboard**
4. 🔌 **Integrar provedores**

---

**⏱️ Tempo estimado**: 2-3 minutos para executar
**🔒 Segurança**: RLS garante isolamento total por organização