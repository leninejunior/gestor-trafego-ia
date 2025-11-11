/**
 * Script para Testar Sistema de Alertas de Saldo
 * 
 * Testa:
 * 1. Busca de saldo das contas
 * 2. Criação de alertas
 * 3. Verificação de alertas
 * 4. Disparo de notificações
 */

// Carregar variáveis de ambiente
require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testarSistemaAlertas() {
  console.log('🔍 Testando Sistema de Alertas de Saldo...\n')

  try {
    // 1. Verificar se as tabelas existem
    console.log('1️⃣ Verificando tabelas...')
    const { data: tables, error: tablesError } = await supabase
      .from('balance_alerts')
      .select('count')
      .limit(1)

    if (tablesError) {
      console.error('❌ Erro ao verificar tabelas:', tablesError.message)
      console.log('\n📝 Execute o schema SQL primeiro:')
      console.log('   database/balance-alerts-schema.sql')
      return
    }

    console.log('✅ Tabelas existem\n')

    // 2. Buscar conexões Meta ativas
    console.log('2️⃣ Buscando conexões Meta ativas...')
    const { data: connections, error: connectionsError } = await supabase
      .from('meta_connections')
      .select(`
        *,
        clients (
          id,
          name
        )
      `)
      .eq('status', 'active')
      .limit(5)

    if (connectionsError) {
      console.error('❌ Erro ao buscar conexões:', connectionsError.message)
      return
    }

    console.log(`✅ Encontradas ${connections?.length || 0} conexões ativas\n`)

    if (!connections || connections.length === 0) {
      console.log('⚠️  Nenhuma conexão Meta ativa encontrada')
      console.log('   Conecte uma conta Meta primeiro para testar alertas')
      return
    }

    // 3. Criar alertas de teste
    console.log('3️⃣ Criando alertas de teste...')
    
    for (const connection of connections.slice(0, 2)) {
      const accountIds = connection.selected_ad_account_ids || []
      
      for (const accountId of accountIds.slice(0, 1)) {
        // Criar alerta de saldo baixo
        const { data: lowBalanceAlert, error: lowBalanceError } = await supabase
          .from('balance_alerts')
          .upsert({
            client_id: connection.clients.id,
            ad_account_id: accountId,
            ad_account_name: `Conta ${accountId}`,
            threshold_amount: 100.00,
            alert_type: 'low_balance',
            is_active: true,
            current_balance: 50.00 // Simular saldo baixo
          }, {
            onConflict: 'client_id,ad_account_id,alert_type'
          })
          .select()
          .single()

        if (lowBalanceError) {
          console.error(`❌ Erro ao criar alerta low_balance:`, lowBalanceError.message)
        } else {
          console.log(`✅ Alerta low_balance criado: ${accountId}`)
        }

        // Criar alerta de saldo zerado
        const { data: noBalanceAlert, error: noBalanceError } = await supabase
          .from('balance_alerts')
          .upsert({
            client_id: connection.clients.id,
            ad_account_id: accountId,
            ad_account_name: `Conta ${accountId}`,
            threshold_amount: 0,
            alert_type: 'no_balance',
            is_active: true,
            current_balance: 0 // Simular saldo zerado
          }, {
            onConflict: 'client_id,ad_account_id,alert_type'
          })
          .select()
          .single()

        if (noBalanceError) {
          console.error(`❌ Erro ao criar alerta no_balance:`, noBalanceError.message)
        } else {
          console.log(`✅ Alerta no_balance criado: ${accountId}`)
        }
      }
    }

    console.log()

    // 4. Listar alertas criados
    console.log('4️⃣ Listando alertas ativos...')
    const { data: alerts, error: alertsError } = await supabase
      .from('balance_alerts')
      .select(`
        *,
        clients (
          name
        )
      `)
      .eq('is_active', true)

    if (alertsError) {
      console.error('❌ Erro ao listar alertas:', alertsError.message)
    } else {
      console.log(`✅ Total de alertas ativos: ${alerts?.length || 0}`)
      
      alerts?.forEach(alert => {
        const status = alert.current_balance <= 0 ? '🔴 CRÍTICO' : 
                      alert.current_balance <= alert.threshold_amount ? '🟡 ATENÇÃO' : 
                      '🟢 OK'
        
        console.log(`   ${status} ${alert.ad_account_name}`)
        console.log(`      Saldo: R$ ${alert.current_balance?.toFixed(2) || '0.00'}`)
        console.log(`      Limite: R$ ${alert.threshold_amount.toFixed(2)}`)
        console.log(`      Tipo: ${alert.alert_type}`)
        console.log()
      })
    }

    // 5. Testar API de saldo
    console.log('5️⃣ Testando API de saldo...')
    console.log('   GET /api/admin/balance/accounts')
    console.log('   (Execute manualmente no navegador ou Postman)\n')

    // 6. Testar API de alertas
    console.log('6️⃣ Testando API de alertas...')
    console.log('   GET /api/admin/balance/alerts')
    console.log('   (Execute manualmente no navegador ou Postman)\n')

    // 7. Testar Cron Job
    console.log('7️⃣ Testando Cron Job...')
    console.log('   POST /api/cron/check-balance-alerts')
    console.log('   (Execute manualmente para testar verificação)\n')

    // 8. Verificar histórico
    console.log('8️⃣ Verificando histórico de alertas...')
    const { data: history, error: historyError } = await supabase
      .from('alert_history')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(10)

    if (historyError) {
      console.error('❌ Erro ao buscar histórico:', historyError.message)
    } else {
      console.log(`✅ Histórico: ${history?.length || 0} alertas enviados`)
      
      history?.forEach(item => {
        console.log(`   ${item.sent_via} para ${item.recipient} - ${item.status}`)
      })
    }

    console.log('\n✅ Teste concluído!')
    console.log('\n📋 Próximos passos:')
    console.log('   1. Acesse /admin/balance para ver a interface')
    console.log('   2. Configure alertas para suas contas')
    console.log('   3. Configure WhatsApp (opcional) em whatsapp_config')
    console.log('   4. Configure Cron Job no Vercel para verificação automática')

  } catch (error) {
    console.error('❌ Erro no teste:', error)
  }
}

// Executar teste
testarSistemaAlertas()
