# Database Schema - Sistema de Checkout e Pagamentos

## Visão Geral

Este documento descreve o schema completo do banco de dados para o sistema de checkout e pagamentos, incluindo todas as tabelas, índices, constraints e políticas RLS.

## Tabelas Principais

### subscription_intents

Tabela central que armazena intenções de assinatura antes da confirmação do pagamento.

```sql
CREATE TABLE subscription_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  billing_cycle VARCHAR(10) NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  
  -- Dados do usuário
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  organization_name VARCHAR(255) NOT NULL,
  cpf_cnpj VARCHAR(20),
  phone VARCHAR(20),
  
  -- Integração com Iugu
  iugu_customer_id VARCHAR(255),
  iugu_subscription_id VARCHAR(255),
  checkout_url TEXT,
  
  -- Relacionamento com usuário criado
  user_id UUID REFERENCES auth.users(id),
  
  -- Metadados e timestamps
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Índices

```sql
-- Índices para performance
CREATE INDEX idx_subscription_intents_status ON subscription_intents(status);
CREATE INDEX idx_subscription_intents_user_email ON subscription_intents(user_email);
CREATE INDEX idx_subscription_intents_expires_at ON subscription_intents(expires_at);
CREATE INDEX idx_subscription_intents_created_at ON subscription_intents(created_at);
CREATE INDEX idx_subscription_intents_iugu_customer ON subscription_intents(iugu_customer_id);

-- Índice composto para consultas de status por usuário
CREATE INDEX idx_subscription_intents_user_status ON subscription_intents(user_email, status);

-- Índice para limpeza de registros expirados
CREATE INDEX idx_subscription_intents_cleanup ON subscription_intents(status, expires_at) 
  WHERE status IN ('pending', 'processing');
```

#### Triggers

```sql
-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscription_intents_updated_at 
  BEFORE UPDATE ON subscription_intents 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para validar transições de status
CREATE OR REPLACE FUNCTION validate_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar transições válidas de status
  IF OLD.status IS NOT NULL AND OLD.status != NEW.status THEN
    -- pending -> processing, failed, expired
    IF OLD.status = 'pending' AND NEW.status NOT IN ('processing', 'failed', 'expired') THEN
      RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
    
    -- processing -> completed, failed, expired
    IF OLD.status = 'processing' AND NEW.status NOT IN ('completed', 'failed', 'expired') THEN
      RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
    
    -- Estados finais não podem ser alterados
    IF OLD.status IN ('completed', 'expired') THEN
      RAISE EXCEPTION 'Cannot change status from final state %', OLD.status;
    END IF;
    
    -- failed pode voltar para pending (retry)
    IF OLD.status = 'failed' AND NEW.status NOT IN ('pending', 'expired') THEN
      RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;
  
  -- Definir completed_at quando status muda para completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER validate_subscription_intent_status_transition
  BEFORE UPDATE ON subscription_intents
  FOR EACH ROW EXECUTE FUNCTION validate_status_transition();
```

### subscription_intent_transitions

Tabela de auditoria para rastrear mudanças de status das intenções.

```sql
CREATE TABLE subscription_intent_transitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_intent_id UUID NOT NULL REFERENCES subscription_intents(id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  reason TEXT,
  triggered_by VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_transitions_intent_id ON subscription_intent_transitions(subscription_intent_id);
CREATE INDEX idx_transitions_created_at ON subscription_intent_transitions(created_at);
CREATE INDEX idx_transitions_status ON subscription_intent_transitions(to_status);
```

#### Trigger para Auditoria

```sql
-- Trigger para registrar transições automaticamente
CREATE OR REPLACE FUNCTION log_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Registrar transição apenas se o status mudou
  IF OLD.status IS NULL OR OLD.status != NEW.status THEN
    INSERT INTO subscription_intent_transitions (
      subscription_intent_id,
      from_status,
      to_status,
      reason,
      triggered_by,
      metadata
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      COALESCE(NEW.metadata->>'transition_reason', 'Status updated'),
      COALESCE(NEW.metadata->>'triggered_by', 'system'),
      jsonb_build_object(
        'timestamp', NOW(),
        'previous_metadata', OLD.metadata,
        'new_metadata', NEW.metadata
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_subscription_intent_transitions
  AFTER UPDATE ON subscription_intents
  FOR EACH ROW EXECUTE FUNCTION log_status_transition();
```

### webhook_logs

Tabela para registrar todos os webhooks recebidos e seu processamento.

```sql
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(255),
  subscription_intent_id UUID REFERENCES subscription_intents(id),
  
  -- Dados do webhook
  payload JSONB NOT NULL,
  headers JSONB DEFAULT '{}',
  source VARCHAR(50) NOT NULL DEFAULT 'iugu',
  
  -- Status de processamento
  status VARCHAR(20) NOT NULL DEFAULT 'received' 
    CHECK (status IN ('received', 'processing', 'processed', 'failed', 'dead_letter')),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at);
CREATE INDEX idx_webhook_logs_intent_id ON webhook_logs(subscription_intent_id);
CREATE INDEX idx_webhook_logs_event_id ON webhook_logs(event_id);

-- Índice para deduplicação
CREATE UNIQUE INDEX idx_webhook_logs_dedup ON webhook_logs(event_id, source) 
  WHERE event_id IS NOT NULL;

-- Índice para retry processing
CREATE INDEX idx_webhook_logs_retry ON webhook_logs(status, retry_count, created_at) 
  WHERE status IN ('failed', 'received');
```

### payment_analytics

Tabela agregada para métricas de negócio e analytics.

```sql
CREATE TABLE payment_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  plan_id UUID REFERENCES subscription_plans(id),
  
  -- Métricas de conversão
  checkouts_started INTEGER DEFAULT 0,
  checkouts_completed INTEGER DEFAULT 0,
  payments_confirmed INTEGER DEFAULT 0,
  payments_failed INTEGER DEFAULT 0,
  
  -- Métricas financeiras
  revenue_total DECIMAL(10,2) DEFAULT 0,
  revenue_monthly DECIMAL(10,2) DEFAULT 0,
  revenue_annual DECIMAL(10,2) DEFAULT 0,
  
  -- Métricas de tempo
  avg_completion_time_minutes INTEGER DEFAULT 0,
  avg_payment_time_minutes INTEGER DEFAULT 0,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint para evitar duplicatas
  UNIQUE(date, plan_id)
);

-- Índices
CREATE INDEX idx_payment_analytics_date ON payment_analytics(date);
CREATE INDEX idx_payment_analytics_plan ON payment_analytics(plan_id);
CREATE INDEX idx_payment_analytics_revenue ON payment_analytics(revenue_total);
```

#### Função para Atualizar Analytics

```sql
-- Função para atualizar métricas diárias
CREATE OR REPLACE FUNCTION update_payment_analytics(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
  INSERT INTO payment_analytics (
    date,
    plan_id,
    checkouts_started,
    checkouts_completed,
    payments_confirmed,
    payments_failed,
    revenue_total,
    revenue_monthly,
    revenue_annual,
    avg_completion_time_minutes
  )
  SELECT 
    target_date,
    si.plan_id,
    COUNT(*) as checkouts_started,
    COUNT(*) FILTER (WHERE si.status IN ('completed', 'processing')) as checkouts_completed,
    COUNT(*) FILTER (WHERE si.status = 'completed') as payments_confirmed,
    COUNT(*) FILTER (WHERE si.status = 'failed') as payments_failed,
    COALESCE(SUM(
      CASE 
        WHEN si.status = 'completed' THEN 
          CASE si.billing_cycle 
            WHEN 'monthly' THEN sp.monthly_price 
            WHEN 'annual' THEN sp.annual_price 
          END
        ELSE 0 
      END
    ), 0) as revenue_total,
    COALESCE(SUM(
      CASE 
        WHEN si.status = 'completed' AND si.billing_cycle = 'monthly' THEN sp.monthly_price 
        ELSE 0 
      END
    ), 0) as revenue_monthly,
    COALESCE(SUM(
      CASE 
        WHEN si.status = 'completed' AND si.billing_cycle = 'annual' THEN sp.annual_price 
        ELSE 0 
      END
    ), 0) as revenue_annual,
    COALESCE(AVG(
      CASE 
        WHEN si.status = 'completed' THEN 
          EXTRACT(EPOCH FROM (si.completed_at - si.created_at)) / 60
        ELSE NULL 
      END
    )::INTEGER, 0) as avg_completion_time_minutes
  FROM subscription_intents si
  JOIN subscription_plans sp ON si.plan_id = sp.id
  WHERE DATE(si.created_at) = target_date
  GROUP BY si.plan_id
  ON CONFLICT (date, plan_id) 
  DO UPDATE SET
    checkouts_started = EXCLUDED.checkouts_started,
    checkouts_completed = EXCLUDED.checkouts_completed,
    payments_confirmed = EXCLUDED.payments_confirmed,
    payments_failed = EXCLUDED.payments_failed,
    revenue_total = EXCLUDED.revenue_total,
    revenue_monthly = EXCLUDED.revenue_monthly,
    revenue_annual = EXCLUDED.revenue_annual,
    avg_completion_time_minutes = EXCLUDED.avg_completion_time_minutes,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
```

## Row Level Security (RLS)

### subscription_intents

```sql
-- Habilitar RLS
ALTER TABLE subscription_intents ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados verem apenas seus próprios intents
CREATE POLICY "Users can view own subscription intents" ON subscription_intents
  FOR SELECT USING (
    auth.uid() = user_id OR 
    user_email = auth.jwt() ->> 'email'
  );

-- Política para criação (qualquer usuário autenticado)
CREATE POLICY "Users can create subscription intents" ON subscription_intents
  FOR INSERT WITH CHECK (true);

-- Política para atualização (apenas sistema e próprio usuário)
CREATE POLICY "Users can update own subscription intents" ON subscription_intents
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    user_email = auth.jwt() ->> 'email' OR
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Política para admins verem tudo
CREATE POLICY "Admins can view all subscription intents" ON subscription_intents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_app_meta_data ->> 'role' = 'admin'
    )
  );
```

### webhook_logs

```sql
-- Habilitar RLS
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins e service role podem acessar logs
CREATE POLICY "Only admins can access webhook logs" ON webhook_logs
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_app_meta_data ->> 'role' = 'admin'
    )
  );
```

### payment_analytics

```sql
-- Habilitar RLS
ALTER TABLE payment_analytics ENABLE ROW LEVEL SECURITY;

-- Admins podem ver tudo
CREATE POLICY "Admins can view payment analytics" ON payment_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_app_meta_data ->> 'role' = 'admin'
    )
  );

-- Service role pode inserir/atualizar
CREATE POLICY "Service role can manage payment analytics" ON payment_analytics
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
```

## Funções de Limpeza

### Limpeza de Intents Expirados

```sql
-- Função para limpar intents expirados
CREATE OR REPLACE FUNCTION cleanup_expired_intents(
  older_than_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Marcar intents pendentes expirados
  UPDATE subscription_intents 
  SET status = 'expired'
  WHERE status IN ('pending', 'processing')
    AND expires_at < NOW();
  
  -- Deletar intents expirados antigos
  DELETE FROM subscription_intents
  WHERE status = 'expired'
    AND created_at < NOW() - (older_than_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

### Limpeza de Webhook Logs

```sql
-- Função para limpar logs antigos de webhook
CREATE OR REPLACE FUNCTION cleanup_webhook_logs(
  older_than_days INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_logs
  WHERE created_at < NOW() - (older_than_days || ' days')::INTERVAL
    AND status IN ('processed', 'dead_letter');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

## Jobs Automáticos

### Cron Jobs (via pg_cron)

```sql
-- Job para limpeza diária de intents expirados
SELECT cron.schedule('cleanup-expired-intents', '0 2 * * *', 'SELECT cleanup_expired_intents(30);');

-- Job para atualização de analytics diárias
SELECT cron.schedule('update-payment-analytics', '0 1 * * *', 'SELECT update_payment_analytics();');

-- Job para limpeza de webhook logs
SELECT cron.schedule('cleanup-webhook-logs', '0 3 * * 0', 'SELECT cleanup_webhook_logs(90);');
```

## Monitoramento e Alertas

### Views para Monitoramento

```sql
-- View para métricas em tempo real
CREATE VIEW subscription_intent_metrics AS
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at)) / 60) as avg_duration_minutes,
  MIN(created_at) as oldest_created,
  MAX(created_at) as newest_created
FROM subscription_intents
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- View para alertas de webhook
CREATE VIEW webhook_alert_metrics AS
SELECT 
  event_type,
  status,
  COUNT(*) as count,
  MAX(created_at) as last_occurrence,
  AVG(retry_count) as avg_retries
FROM webhook_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type, status
HAVING COUNT(*) > 10 OR AVG(retry_count) > 3;
```

## Backup e Recovery

### Backup Incremental

```sql
-- Função para backup incremental de dados críticos
CREATE OR REPLACE FUNCTION backup_critical_data(backup_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(table_name TEXT, record_count BIGINT) AS $$
BEGIN
  -- Backup de subscription_intents do dia
  RETURN QUERY
  SELECT 'subscription_intents'::TEXT, COUNT(*)
  FROM subscription_intents
  WHERE DATE(created_at) = backup_date;
  
  -- Backup de webhook_logs do dia
  RETURN QUERY
  SELECT 'webhook_logs'::TEXT, COUNT(*)
  FROM webhook_logs
  WHERE DATE(created_at) = backup_date;
  
  -- Backup de payment_analytics
  RETURN QUERY
  SELECT 'payment_analytics'::TEXT, COUNT(*)
  FROM payment_analytics
  WHERE date = backup_date;
END;
$$ LANGUAGE plpgsql;
```

## Performance e Otimização

### Particionamento (Futuro)

Para grandes volumes, considerar particionamento por data:

```sql
-- Exemplo de particionamento para webhook_logs
CREATE TABLE webhook_logs_y2024m01 PARTITION OF webhook_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Índices Parciais

```sql
-- Índices parciais para queries específicas
CREATE INDEX idx_active_intents ON subscription_intents(created_at, status)
  WHERE status IN ('pending', 'processing');

CREATE INDEX idx_failed_webhooks ON webhook_logs(created_at, retry_count)
  WHERE status = 'failed';
```

Este schema garante integridade, performance e observabilidade completa do sistema de checkout e pagamentos.