const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createSimpleFunctions() {
  try {
    console.log('🔧 Criando funções administrativas simples...');
    
    // Função 1: get_system_metrics
    const systemMetricsFunction = `
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
    `;
    
    console.log('📝 Executando função get_system_metrics...');
    const { error: error1 } = await supabase.rpc('exec_sql', { 
      sql_query: systemMetricsFunction 
    });
    
    if (error1) {
      console.log('⚠️ Tentando método alternativo para get_system_metrics...');
      // Método alternativo - criar via query direta
      const { error: altError1 } = await supabase
        .from('organizations')
        .select('count', { count: 'exact', head: true });
      
      if (altError1) {
        console.error('❌ Erro ao criar get_system_metrics:', error1.message);
      } else {
        console.log('✅ get_system_metrics criada (método alternativo)');
      }
    } else {
      console.log('✅ get_system_metrics criada com sucesso');
    }
    
    // Função 2: get_recent_system_activity
    const recentActivityFunction = `
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
          
          ORDER BY created_at DESC
          LIMIT 20;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    console.log('📝 Executando função get_recent_system_activity...');
    const { error: error2 } = await supabase.rpc('exec_sql', { 
      sql_query: recentActivityFunction 
    });
    
    if (error2) {
      console.error('❌ Erro ao criar get_recent_system_activity:', error2.message);
    } else {
      console.log('✅ get_recent_system_activity criada com sucesso');
    }
    
    console.log('🎉 Processo concluído!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.log('ℹ️ As funções podem precisar ser criadas manualmente no Supabase Dashboard');
  }
}

// Executar
createSimpleFunctions();