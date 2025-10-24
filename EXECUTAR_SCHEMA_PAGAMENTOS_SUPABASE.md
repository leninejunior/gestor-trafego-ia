# 🚀 Executar Schema de Pagamentos no Supabase

## ⚠️ **MCP Indisponível - Execução Manual**

O MCP do Supabase não está conectado no momento. Vamos executar manualmente no SQL Editor.

## 📋 **Passo a Passo**

### **1. Abrir Supabase**
- Acesse: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv
- Clique em **"SQL Editor"** no menu lateral
- Clique em **"New Query"**

### **2. Executar em Partes (Recomendado)**

Execute cada bloco separadamente para evitar timeouts:

#### **Parte 1: Tabela de Provedores**
```sql
-- 1. Provedores de Pagamento
CREATE TABLE IF NOT EXISTS payment_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_sandbox BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1,
  config JSONB NOT NULL DEFAULT '{}',
  success_rate DECIMAL(5,2) DEFAULT 100.00,
  avg_response_time INTEGER DEFAULT 0,
  last_health_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, name)
);
```

#### **Parte 2: Tabela de Transações**
```sql
-- 2. Transações de Pagamento
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  provider_id UUID NOT NULL REFERENCES payment_providers(id) ON DELETE RESTRICT,
  external_id TEXT,
  reference_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  customer_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  processed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **Parte 3: Tabela de Assinaturas**
```sql
-- 3. Assinaturas/Recorrências
CREATE TABLE IF NOT EXISTS payment_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  provider_id UUID NOT NULL REFERENCES payment_providers(id) ON DELETE RESTRICT,
  external_id TEXT,
  plan_name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  interval_type TEXT NOT NULL,
  interval_count INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  customer_data JSONB DEFAULT '{}',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **Parte 4: Tabela de Webhooks**
```sql
-- 4. Webhooks Recebidos
CREATE TABLE IF NOT EXISTS payment_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_id TEXT,
  payload JSONB NOT NULL,
  headers JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  transaction_id UUID REFERENCES payment_transactions(id),
  subscription_id UUID REFERENCES payment_subscriptions(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **Parte 5: Tabela de Auditoria**
```sql
-- 5. Log de Auditoria de Pagamentos
CREATE TABLE IF NOT EXISTS payment_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **Parte 6: Índices**
```sql
-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_org_id ON payment_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_client_id ON payment_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_id ON payment_transactions(provider_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_external_id ON payment_transactions(external_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_org_id ON payment_subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_client_id ON payment_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_provider_id ON payment_subscriptions(provider_id);
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_status ON payment_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_external_id ON payment_subscriptions(external_id);

CREATE INDEX IF NOT EXISTS idx_payment_webhooks_provider_name ON payment_webhooks(provider_name);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_event_type ON payment_webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_processed ON payment_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_created_at ON payment_webhooks(created_at);

CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_org_id ON payment_audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_entity_type_id ON payment_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_created_at ON payment_audit_logs(created_at);
```

#### **Parte 7: RLS Policies**
```sql
-- Habilitar RLS
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

-- Policies para payment_webhooks
CREATE POLICY "Users can view webhooks" ON payment_webhooks
  FOR SELECT USING (true);

-- Policies para payment_audit_logs
CREATE POLICY "Users can view audit logs from their organization" ON payment_audit_logs
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM memberships WHERE user_id = auth.uid()
    )
  );
```

#### **Parte 8: Triggers**
```sql
-- Função para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_payment_providers_updated_at BEFORE UPDATE ON payment_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_subscriptions_updated_at BEFORE UPDATE ON payment_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## ✅ **Verificação**

Após executar todas as partes, verifique se as tabelas foram criadas:

```sql
-- Verificar tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'payment_%';
```

## 🎉 **Resultado Esperado**

Você deve ver 5 tabelas:
- `payment_providers`
- `payment_transactions` 
- `payment_subscriptions`
- `payment_webhooks`
- `payment_audit_logs`

---

**⏱️ Tempo total**: 5-10 minutos
**🔗 Link direto**: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql