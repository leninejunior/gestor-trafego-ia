-- Funções para o painel administrativo

-- Função para buscar estatísticas de uma organização
CREATE OR REPLACE FUNCTION get_organization_stats(org_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_members', (
            SELECT COUNT(*) FROM memberships 
            WHERE organization_id = org_id
        ),
        'active_members', (
            SELECT COUNT(*) FROM memberships 
            WHERE organization_id = org_id AND status = 'active'
        ),
        'pending_invites', (
            SELECT COUNT(*) FROM memberships 
            WHERE organization_id = org_id AND status = 'pending'
        ),
        'total_clients', (
            SELECT COUNT(*) FROM clients 
            WHERE organization_id = org_id
        ),
        'total_connections', (
            SELECT COUNT(*) FROM client_meta_connections cmc
            JOIN clients c ON c.id = cmc.client_id
            WHERE c.organization_id = org_id
        ),
        'active_connections', (
            SELECT COUNT(*) FROM client_meta_connections cmc
            JOIN clients c ON c.id = cmc.client_id
            WHERE c.organization_id = org_id AND cmc.is_active = true
        ),
        'monthly_revenue', (
            SELECT COALESCE(sp.price_monthly, 0)
            FROM subscriptions s
            JOIN subscription_plans sp ON sp.id = s.plan_id
            WHERE s.organization_id = org_id AND s.status = 'active'
            LIMIT 1
        ),
        'days_as_customer', (
            SELECT EXTRACT(DAY FROM NOW() - created_at)
            FROM organizations
            WHERE id = org_id
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para buscar todas as organizações com estatísticas
CREATE OR REPLACE FUNCTION get_all_organizations_with_stats()
RETURNS TABLE (
    id UUID,
    name TEXT,
    created_at TIMESTAMPTZ,
    total_members BIGINT,
    active_members BIGINT,
    total_clients BIGINT,
    total_connections BIGINT,
    monthly_revenue DECIMAL,
    plan_name TEXT,
    subscription_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.name,
        o.created_at,
        COALESCE(member_stats.total_members, 0) as total_members,
        COALESCE(member_stats.active_members, 0) as active_members,
        COALESCE(client_stats.total_clients, 0) as total_clients,
        COALESCE(connection_stats.total_connections, 0) as total_connections,
        COALESCE(sp.price_monthly, 0) as monthly_revenue,
        sp.name as plan_name,
        s.status as subscription_status
    FROM organizations o
    LEFT JOIN (
        SELECT 
            organization_id,
            COUNT(*) as total_members,
            COUNT(*) FILTER (WHERE status = 'active') as active_members
        FROM memberships
        GROUP BY organization_id
    ) member_stats ON member_stats.organization_id = o.id
    LEFT JOIN (
        SELECT 
            organization_id,
            COUNT(*) as total_clients
        FROM clients
        GROUP BY organization_id
    ) client_stats ON client_stats.organization_id = o.id
    LEFT JOIN (
        SELECT 
            c.organization_id,
            COUNT(*) as total_connections
        FROM client_meta_connections cmc
        JOIN clients c ON c.id = cmc.client_id
        GROUP BY c.organization_id
    ) connection_stats ON connection_stats.organization_id = o.id
    LEFT JOIN subscriptions s ON s.organization_id = o.id AND s.status = 'active'
    LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
    ORDER BY o.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para buscar métricas globais do sistema
CREATE OR REPLACE FUNCTION get_system_metrics()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_organizations', (SELECT COUNT(*) FROM organizations),
        'total_users', (SELECT COUNT(*) FROM user_profiles),
        'total_active_subscriptions', (
            SELECT COUNT(*) FROM subscriptions WHERE status = 'active'
        ),
        'total_monthly_revenue', (
            SELECT COALESCE(SUM(sp.price_monthly), 0)
            FROM subscriptions s
            JOIN subscription_plans sp ON sp.id = s.plan_id
            WHERE s.status = 'active'
        ),
        'total_clients', (SELECT COUNT(*) FROM clients),
        'total_connections', (SELECT COUNT(*) FROM client_meta_connections),
        'active_connections', (
            SELECT COUNT(*) FROM client_meta_connections WHERE is_active = true
        ),
        'growth_this_month', (
            SELECT COUNT(*) FROM organizations 
            WHERE created_at >= date_trunc('month', CURRENT_DATE)
        ),
        'churn_rate', (
            SELECT ROUND(
                (COUNT(*) FILTER (WHERE status = 'cancelled')::DECIMAL / 
                 NULLIF(COUNT(*), 0)) * 100, 2
            )
            FROM subscriptions
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para buscar atividade recente do sistema
CREATE OR REPLACE FUNCTION get_recent_system_activity()
RETURNS TABLE (
    activity_type TEXT,
    description TEXT,
    organization_name TEXT,
    user_name TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    -- Novos membros
    SELECT 
        'new_member'::TEXT as activity_type,
        'Novo membro adicionado'::TEXT as description,
        o.name as organization_name,
        COALESCE(up.first_name || ' ' || up.last_name, 'Usuário') as user_name,
        m.created_at
    FROM memberships m
    JOIN organizations o ON o.id = m.organization_id
    LEFT JOIN user_profiles up ON up.id = m.user_id
    WHERE m.created_at >= NOW() - INTERVAL '7 days'
    
    UNION ALL
    
    -- Novas organizações
    SELECT 
        'new_organization'::TEXT as activity_type,
        'Nova organização criada'::TEXT as description,
        o.name as organization_name,
        ''::TEXT as user_name,
        o.created_at
    FROM organizations o
    WHERE o.created_at >= NOW() - INTERVAL '7 days'
    
    UNION ALL
    
    -- Novas assinaturas
    SELECT 
        'new_subscription'::TEXT as activity_type,
        'Nova assinatura ativada'::TEXT as description,
        o.name as organization_name,
        sp.name as user_name,
        s.created_at
    FROM subscriptions s
    JOIN organizations o ON o.id = s.organization_id
    JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE s.created_at >= NOW() - INTERVAL '7 days'
    
    ORDER BY created_at DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;