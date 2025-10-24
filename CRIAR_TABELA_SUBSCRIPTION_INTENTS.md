# ✅ Criar Tabela subscription_intents - EXECUTAR AGORA

## Problema

```
ERROR: 42P01: relation "subscription_intents" does not exist
```

## Solução

A tabela `subscription_intents` precisa ser criada no Supabase.

## Opção 1: Via Supabase SQL Editor (RECOMENDADO)

1. Acesse o Supabase Dashboard: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor** (menu lateral)
4. Clique em **New Query**
5. Cole o conteúdo do arquivo: `database/create-subscription-intents-complete.sql`
6. Clique em **Run** ou pressione `Ctrl+Enter`

## Opção 2: Copiar e Colar SQL

Copie e cole este SQL no Supabase SQL Editor:

```sql
-- Criar tabela subscription_intents completa
CREATE TABLE IF NOT EXISTS subscription_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    billing_cycle VARCHAR(10) NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
    iugu_customer_id VARCHAR(255),
    iugu_plan_identifier VARCHAR(255),
    iugu_subscription_id VARCHAR(255),
    user_email TEXT,
    user_name TEXT,
    organization_name TEXT,
    cpf_cnpj TEXT,
    phone TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Tornar campos opcionais
ALTER TABLE subscription_intents ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE subscription_intents ALTER COLUMN user_id DROP NOT NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscription_intents_user_email ON subscription_intents(user_email);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_iugu_customer ON subscription_intents(iugu_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscription_intents_status ON subscription_intents(status);

-- RLS
ALTER TABLE subscription_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_intents_user_access" ON subscription_intents
    FOR ALL USING (
        user_id = auth.uid()
        OR organization_id IN (
            SELECT m.organization_id FROM memberships m WHERE m.user_id = auth.uid()
        )
        OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_intents_updated_at 
    BEFORE UPDATE ON subscription_intents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Verificar se Funcionou

Após executar o SQL, teste novamente o checkout:

1. Acesse `http://localhost:3000`
2. Escolha um plano
3. Preencha o formulário
4. Clique em "Continuar para Pagamento"

Agora deve funcionar sem o erro de tabela não encontrada!

## O Que Esta Tabela Faz

A tabela `subscription_intents` armazena os dados do checkout ANTES de criar a conta do usuário:

- Email, nome, empresa
- Plano escolhido
- IDs do Iugu (customer, subscription)
- Status do pagamento

Quando o pagamento for confirmado via webhook, esses dados serão usados para criar a conta do usuário.

## Próximo Passo

Após criar a tabela, o checkout funcionará e você verá:
1. Formulário sem senha ✅
2. Redirecionamento para Iugu ✅
3. Opções de pagamento (cartão, boleto, PIX) ✅
