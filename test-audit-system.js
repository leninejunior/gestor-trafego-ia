/**
 * Test script para verificar o sistema de auditoria
 * Execute: node test-audit-system.js
 */

const { createClient } = require('@supabase/supabase-js')

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas')
  console.error('Necessário: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testAuditSystem() {
  console.log('🔍 Testando Sistema de Auditoria...\n')

  try {
    // 1. Verificar se a tabela existe
    console.log('1. Verificando tabela user_access_audit_log...')
    const { data: tableCheck, error: tableError } = await supabase
      .from('user_access_audit_log')
      .select('count')
      .limit(1)

    if (tableError) {
      console.error('❌ Tabela não encontrada:', tableError.message)
      console.log('💡 Execute a migração: database/migrations/11-user-access-audit-log.sql')
      return
    }
    console.log('✅ Tabela user_access_audit_log existe')

    // 2. Verificar função log_user_access_event
    console.log('\n2. Testando função log_user_access_event...')
    const { data: functionTest, error: functionError } = await supabase.rpc('log_user_access_event', {
      p_event_type: 'user_create',
      p_event_category: 'user_management',
      p_actor_user_id: '00000000-0000-0000-0000-000000000000',
      p_action: 'Test audit system',
      p_success: true,
      p_metadata: { test: true, timestamp: new Date().toISOString() }
    })

    if (functionError) {
      console.error('❌ Erro na função:', functionError.message)
      return
    }
    console.log('✅ Função log_user_access_event funcionando')
    console.log('📝 Log ID criado:', functionTest)

    // 3. Verificar se o log foi inserido
    console.log('\n3. Verificando inserção do log...')
    const { data: logCheck, error: logError } = await supabase
      .from('user_access_audit_log')
      .select('*')
      .eq('id', functionTest)
      .single()

    if (logError) {
      console.error('❌ Erro ao buscar log:', logError.message)
      return
    }
    console.log('✅ Log inserido com sucesso')
    console.log('📋 Dados do log:', {
      id: logCheck.id,
      event_type: logCheck.event_type,
      event_category: logCheck.event_category,
      action: logCheck.action,
      success: logCheck.success,
      created_at: logCheck.created_at
    })

    // 4. Testar função de estatísticas
    console.log('\n4. Testando função get_audit_statistics...')
    const { data: statsTest, error: statsError } = await supabase.rpc('get_audit_statistics', {
      p_start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h atrás
      p_end_date: new Date().toISOString()
    })

    if (statsError) {
      console.error('❌ Erro nas estatísticas:', statsError.message)
      return
    }
    console.log('✅ Função get_audit_statistics funcionando')
    console.log('📊 Estatísticas:', {
      total_events: statsTest.summary?.total_events || 0,
      successful_events: statsTest.summary?.successful_events || 0,
      failed_events: statsTest.summary?.failed_events || 0
    })

    // 5. Verificar view detalhada
    console.log('\n5. Testando view user_access_audit_log_detailed...')
    const { data: viewTest, error: viewError } = await supabase
      .from('user_access_audit_log_detailed')
      .select('*')
      .limit(5)

    if (viewError) {
      console.error('❌ Erro na view:', viewError.message)
      return
    }
    console.log('✅ View user_access_audit_log_detailed funcionando')
    console.log('📄 Registros encontrados:', viewTest.length)

    // 6. Verificar RLS policies
    console.log('\n6. Verificando RLS policies...')
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('policyname, cmd, roles')
      .eq('tablename', 'user_access_audit_log')

    if (policiesError) {
      console.error('❌ Erro ao verificar policies:', policiesError.message)
    } else {
      console.log('✅ RLS Policies encontradas:', policies.length)
      policies.forEach(policy => {
        console.log(`  - ${policy.policyname} (${policy.cmd})`)
      })
    }

    // 7. Limpar log de teste
    console.log('\n7. Limpando log de teste...')
    const { error: deleteError } = await supabase
      .from('user_access_audit_log')
      .delete()
      .eq('id', functionTest)

    if (deleteError) {
      console.warn('⚠️  Não foi possível deletar log de teste:', deleteError.message)
    } else {
      console.log('✅ Log de teste removido')
    }

    console.log('\n🎉 Sistema de Auditoria está funcionando corretamente!')
    console.log('\n📋 Próximos passos:')
    console.log('1. Testar APIs: /api/super-admin/audit-logs e /api/super-admin/audit-stats')
    console.log('2. Testar dashboard de auditoria no super admin')
    console.log('3. Verificar logs sendo criados durante operações de usuário')

  } catch (error) {
    console.error('❌ Erro geral:', error.message)
    console.error('Stack:', error.stack)
  }
}

// Executar teste
testAuditSystem().then(() => {
  console.log('\n✨ Teste concluído')
  process.exit(0)
}).catch(error => {
  console.error('💥 Erro fatal:', error)
  process.exit(1)
})