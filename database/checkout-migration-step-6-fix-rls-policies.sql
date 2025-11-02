-- =====================================================
-- PASSO 6: CORREÇÃO DAS POLÍTICAS RLS DE SEGURANÇA
-- =====================================================
-- Este arquivo corrige as políticas RLS que estavam aplicadas
-- incorretamente ao role 'public', implementando segurança adequada

\echo '🔧 PASSO 6: Corrigindo políticas RLS de segurança...'

-- =====================================================
-- REMOVER POLÍTICAS INCORRETAS EXISTENTES
-- =====================================================

\echo '🗑️ Removendo políticas RLS incorretas...'

-- Remover políticas da tabela payment_analytics
DROP POLICY IF EXISTS "Admins can view payment analytics" ON payment_analytics;
DROP POLICY IF EXISTS "Service role can manage payment analytics" ON payment_analytics;
DROP POLICY IF EXISTS "payment_analytics_admin_access" ON payment_analytics;

-- Remover políticas da tabela subscription_intent_transitions
DROP POLICY IF EXISTS "Admins can view all transitions" ON subscription_intent_transitions;
DROP POLICY IF EXISTS "Service role can manage transitions" ON subscription_intent_transitions;
DROP POLICY IF EXISTS "Users can view own intent transitions" ON subscription_intent_transitions;

-- Remover políticas da tabela subscription_intents
DROP POLICY IF EXISTS "Admins can view all subscription intents" ON subscription_intents;
DROP POLICY IF EXISTS "Users can create subscription intents" ON subscription_intents;
DROP POLICY IF EXISTS "Users can update own subscription intents" ON subscription_intents;
DROP POLICY IF EXISTS "Users can view own subscription intents" ON subscription_intents;
DROP POLICY IF EXISTS "subscription_intents_admin_access" ON subscription_intents;
DROP POLICY IF EXISTS "subscription_intents_user_own_access" ON subscription_intents;

-- Remover políticas da tabela webhook_logs
DROP POLICY IF EXISTS "Allow webhook insertion" ON webhook_logs;
DROP POLICY IF EXISTS "Only admins can access webhook logs" ON webhook_logs;
DROP POLICY IF EXISTS "webhook_logs_admin_access" ON webhook_logs;

\echo '✅ Políticas incorretas removidas'

-- =====================================================
-- POLÍTICAS CORRETAS PARA SUBSCRIPTION_INTENTS
-- =====================================================

\echo '🔐 Criando políticas corretas para subscription_intents...'

-- Usuários podem criar seus próprios subscription intents
CREATE POLICY "users_can_create_own_subscription_intents" ON subscription_intents
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Usuários podem visualizar apenas seus próprios subscription intents
CREATE POLICY "users_can_view_own_subscription_intents" ON subscription_intents
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Usuários podem atualizar apenas seus próprios subscription intents
CREATE POLICY "users_can_update_own_subscription_intents" ON subscription_intents
    FOR UPDATE 
    USING (auth.uid() = user_id);

-- Service role pode fazer tudo (para webhooks e processamento)
CREATE POLICY "service_role_full_access_subscription_intents" ON subscription_intents
    FOR ALL 
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Admins podem visualizar e gerenciar todos os subscription intents
CREATE POLICY "admins_full_access_subscription_intents" ON subscription_intents
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data ->> 'role' = 'admin'
        )
    );

\echo '✅ Políticas de subscription_intents criadas'

-- =====================================================
-- POLÍTICAS CORRETAS PARA SUBSCRIPTION_INTENT_TRANSITIONS
-- =====================================================

\echo '🔐 Criando políticas corretas para subscription_intent_transitions...'

-- Usuários podem visualizar transições dos seus próprios intents
CREATE POLICY "users_can_view_own_intent_transitions" ON subscription_intent_transitions
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM subscription_intents si 
            WHERE si.id = subscription_intent_transitions.subscription_intent_id 
            AND si.user_id = auth.uid()
        )
    );

-- Service role pode inserir e gerenciar transições
CREATE POLICY "service_role_full_access_transitions" ON subscription_intent_transitions
    FOR ALL 
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Admins podem visualizar e gerenciar todas as transições
CREATE POLICY "admins_full_access_transitions" ON subscription_intent_transitions
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data ->> 'role' = 'admin'
        )
    );

\echo '✅ Políticas de subscription_intent_transitions criadas'

-- =====================================================
-- POLÍTICAS CORRETAS PARA WEBHOOK_LOGS
-- =====================================================

\echo '🔐 Criando políticas corretas para webhook_logs...'

-- Service role pode inserir e gerenciar webhook logs
CREATE POLICY "service_role_full_access_webhook_logs" ON webhook_logs
    FOR ALL 
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Admins podem visualizar e gerenciar todos os webhook logs
CREATE POLICY "admins_full_access_webhook_logs" ON webhook_logs
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data ->> 'role' = 'admin'
        )
    );

\echo '✅ Políticas de webhook_logs criadas'

-- =====================================================
-- POLÍTICAS CORRETAS PARA PAYMENT_ANALYTICS
-- =====================================================

\echo '🔐 Criando políticas corretas para payment_analytics...'

-- Service role pode inserir e gerenciar analytics
CREATE POLICY "service_role_full_access_payment_analytics" ON payment_analytics
    FOR ALL 
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Admins podem visualizar e gerenciar todas as analytics
CREATE POLICY "admins_full_access_payment_analytics" ON payment_analytics
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data ->> 'role' = 'admin'
        )
    );

-- Usuários podem visualizar apenas analytics relacionadas aos seus intents
CREATE POLICY "users_can_view_own_payment_analytics" ON payment_analytics
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM subscription_intents si 
            WHERE si.id = payment_analytics.subscription_intent_id 
            AND si.user_id = auth.uid()
        )
    );

\echo '✅ Políticas de payment_analytics criadas'

-- =====================================================
-- GARANTIR QUE RLS ESTÁ HABILITADO
-- =====================================================

\echo '🔒 Garantindo que RLS está habilitado em todas as tabelas...'

ALTER TABLE subscription_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_intent_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_analytics ENABLE ROW LEVEL SECURITY;

\echo '✅ RLS habilitado em todas as tabelas'

-- =====================================================
-- VERIFICAÇÃO FINAL DAS POLÍTICAS
-- =====================================================

\echo '🔍 Verificando políticas aplicadas...'

SELECT 
    '📋 Políticas RLS aplicadas:' as status;

SELECT 
    schemaname,
    tablename,
    policyname,
    CASE 
        WHEN permissive = 'PERMISSIVE' THEN '✅'
        ELSE '❌'
    END as status,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN (
    'subscription_intents', 
    'subscription_intent_transitions', 
    'webhook_logs', 
    'payment_analytics'
)
ORDER BY tablename, policyname;

\echo ''
\echo '🎉 PASSO 6 CONCLUÍDO: Políticas RLS corrigidas com sucesso!'
\echo ''
\echo '📊 RESUMO DA SEGURANÇA:'
\echo '   • Usuários só podem ver/editar seus próprios subscription intents'
\echo '   • Usuários só podem ver transições dos seus próprios intents'  
\echo '   • Apenas admins e service roles podem acessar webhook logs'
\echo '   • Apenas admins e service roles podem acessar payment analytics'
\echo '   • Service role tem acesso total para processamento de webhooks'
\echo ''