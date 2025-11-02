-- =====================================================
-- MIGRAÇÃO CHECKOUT - PASSO 5: POLÍTICAS RLS
-- =====================================================
-- Execute este SQL após o Passo 4
-- Configura Row Level Security para as tabelas de checkout

-- HABILITAR RLS nas tabelas

-- Habilitar RLS para subscription_intents
ALTER TABLE subscription_intents ENABLE ROW LEVEL SECURITY;

-- Habilitar RLS para subscription_intent_transitions
ALTER TABLE subscription_intent_transitions ENABLE ROW LEVEL SECURITY;

-- Habilitar RLS para webhook_logs
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Habilitar RLS para payment_analytics
ALTER TABLE payment_analytics ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS PARA subscription_intents

-- Política para usuários autenticados verem apenas seus próprios intents
DROP POLICY IF EXISTS "Users can view own subscription intents" ON subscription_intents;
CREATE POLICY "Users can view own subscription intents" ON subscription_intents
    FOR SELECT 
    TO authenticated
    USING (
        auth.uid() = user_id OR 
        user_email = auth.jwt() ->> 'email'
    );

-- Política para criação (qualquer usuário autenticado pode criar)
DROP POLICY IF EXISTS "Users can create subscription intents" ON subscription_intents;
CREATE POLICY "Users can create subscription intents" ON subscription_intents
    FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

-- Política para atualização (apenas próprio usuário)
DROP POLICY IF EXISTS "Users can update own subscription intents" ON subscription_intents;
CREATE POLICY "Users can update own subscription intents" ON subscription_intents
    FOR UPDATE 
    TO authenticated
    USING (
        auth.uid() = user_id OR 
        user_email = auth.jwt() ->> 'email'
    );

-- Política para service role ter acesso total
DROP POLICY IF EXISTS "Service role full access subscription intents" ON subscription_intents;
CREATE POLICY "Service role full access subscription intents" ON subscription_intents
    FOR ALL 
    TO service_role
    USING (true);

-- Política para admins verem tudo
DROP POLICY IF EXISTS "Admins can view all subscription intents" ON subscription_intents;
CREATE POLICY "Admins can view all subscription intents" ON subscription_intents
    FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND (
                auth.users.raw_app_meta_data ->> 'role' = 'admin' OR
                auth.users.raw_app_meta_data ->> 'is_admin' = 'true'
            )
        )
    );

-- POLÍTICAS PARA subscription_intent_transitions

-- Apenas usuários autenticados podem ver transições de seus próprios intents
DROP POLICY IF EXISTS "Users can view own intent transitions" ON subscription_intent_transitions;
CREATE POLICY "Users can view own intent transitions" ON subscription_intent_transitions
    FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM subscription_intents si
            WHERE si.id = subscription_intent_id
            AND (
                auth.uid() = si.user_id OR 
                si.user_email = auth.jwt() ->> 'email'
            )
        )
    );

-- Service role pode gerenciar todas as transições
DROP POLICY IF EXISTS "Service role can manage transitions" ON subscription_intent_transitions;
CREATE POLICY "Service role can manage transitions" ON subscription_intent_transitions
    FOR ALL 
    TO service_role
    USING (true);

-- Admins podem ver todas as transições
DROP POLICY IF EXISTS "Admins can view all transitions" ON subscription_intent_transitions;
CREATE POLICY "Admins can view all transitions" ON subscription_intent_transitions
    FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND (
                auth.users.raw_app_meta_data ->> 'role' = 'admin' OR
                auth.users.raw_app_meta_data ->> 'is_admin' = 'true'
            )
        )
    );

-- POLÍTICAS PARA webhook_logs

-- Service role pode gerenciar todos os logs de webhook
DROP POLICY IF EXISTS "Service role can manage webhook logs" ON webhook_logs;
CREATE POLICY "Service role can manage webhook logs" ON webhook_logs
    FOR ALL 
    TO service_role
    USING (true);

-- Apenas admins podem acessar logs de webhook
DROP POLICY IF EXISTS "Only admins can access webhook logs" ON webhook_logs;
CREATE POLICY "Only admins can access webhook logs" ON webhook_logs
    FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND (
                auth.users.raw_app_meta_data ->> 'role' = 'admin' OR
                auth.users.raw_app_meta_data ->> 'is_admin' = 'true'
            )
        )
    );

-- Política especial para inserção de webhooks (anônimo - endpoint público do Iugu)
DROP POLICY IF EXISTS "Allow webhook insertion" ON webhook_logs;
CREATE POLICY "Allow webhook insertion" ON webhook_logs
    FOR INSERT 
    TO anon
    WITH CHECK (true);

-- POLÍTICAS PARA payment_analytics

-- Service role pode gerenciar todas as analytics
DROP POLICY IF EXISTS "Service role can manage payment analytics" ON payment_analytics;
CREATE POLICY "Service role can manage payment analytics" ON payment_analytics
    FOR ALL 
    TO service_role
    USING (true);

-- Admins podem ver analytics
DROP POLICY IF EXISTS "Admins can view payment analytics" ON payment_analytics;
CREATE POLICY "Admins can view payment analytics" ON payment_analytics
    FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND (
                auth.users.raw_app_meta_data ->> 'role' = 'admin' OR
                auth.users.raw_app_meta_data ->> 'is_admin' = 'true'
            )
        )
    );

-- Usuários podem ver analytics de seus próprios planos (se implementado no futuro)
DROP POLICY IF EXISTS "Users can view own plan analytics" ON payment_analytics;
CREATE POLICY "Users can view own plan analytics" ON payment_analytics
    FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM subscription_intents si
            WHERE si.plan_id = payment_analytics.plan_id
            AND (
                auth.uid() = si.user_id OR 
                si.user_email = auth.jwt() ->> 'email'
            )
        )
    );

-- FUNÇÃO: Verificar permissões de usuário
CREATE OR REPLACE FUNCTION check_user_permissions(user_id_param UUID)
RETURNS TABLE(
    is_admin BOOLEAN,
    is_service_role BOOLEAN,
    email TEXT,
    role TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(
            (raw_app_meta_data ->> 'role' = 'admin'),
            (raw_app_meta_data ->> 'is_admin' = 'true'),
            false
        ) as is_admin,
        false as is_service_role, -- Service role não tem registro na tabela users
        u.email,
        COALESCE(raw_app_meta_data ->> 'role', 'user') as role
    FROM auth.users u
    WHERE u.id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNÇÃO: Verificar se usuário pode acessar intent
CREATE OR REPLACE FUNCTION can_access_subscription_intent(
    intent_id_param UUID,
    user_id_param UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
    can_access BOOLEAN := false;
    user_email_from_jwt TEXT;
BEGIN
    -- Obter email do JWT se disponível
    user_email_from_jwt := auth.jwt() ->> 'email';
    
    -- Verificar se é admin ou service role
    IF auth.jwt() ->> 'role' = 'service_role' THEN
        RETURN true;
    END IF;
    
    -- Verificar se é admin
    IF EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = user_id_param 
        AND (
            raw_app_meta_data ->> 'role' = 'admin' OR
            raw_app_meta_data ->> 'is_admin' = 'true'
        )
    ) THEN
        RETURN true;
    END IF;
    
    -- Verificar se é o próprio usuário
    SELECT EXISTS (
        SELECT 1 FROM subscription_intents
        WHERE id = intent_id_param
        AND (
            user_id = user_id_param OR
            user_email = user_email_from_jwt
        )
    ) INTO can_access;
    
    RETURN can_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários nas políticas
COMMENT ON POLICY "Users can view own subscription intents" ON subscription_intents IS 
    'Usuários podem ver apenas suas próprias intenções de assinatura';

COMMENT ON POLICY "Admins can view all subscription intents" ON subscription_intents IS 
    'Administradores e service role podem ver todas as intenções';

COMMENT ON POLICY "Only admins can access webhook logs" ON webhook_logs IS 
    'Apenas administradores podem acessar logs de webhook';

-- Verificação das políticas RLS criadas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN (
    'subscription_intents', 
    'subscription_intent_transitions', 
    'webhook_logs', 
    'payment_analytics'
)
ORDER BY tablename, policyname;