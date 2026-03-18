/**
 * Script de Teste do Sistema de Saldo Meta Ads
 * Verifica se as tabelas existem e se a funcionalidade está operacional
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testBalanceSystem() {
  console.log('🔍 TESTE DO SISTEMA DE SALDO META ADS\n')
  console.log('=' .repeat(60))

  // 1. Verificar se as tabelas existem
  console.log('\n📊 1. VERIFICANDO TABELAS...\n')
  
  const tables = [
    'ad_account_balances',
    'balance_alerts',
    'alert_history',
    'alert_recipients',
    'whatsapp_config'
  ]

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

      if (error) {
        console.log(`❌ ${table}: NÃO EXISTE`)
        console.log(`   Erro: ${error.message}`)
      } else {
        console.log(`✅ ${table}: OK`)
      }
    } catch (err) {
      console.log(`❌ ${table}: ERRO`)
      console.log(`   ${err.message}`)
    }
  }

  // 2. Verificar conexões Meta ativas
  console.log('\n📊 2. VERIFICANDO CONEXÕES META...\n')
  
  const { data: connections, error: connError } = await supabase
    .from('client_meta_connections')
    .select('id, client_id, ad_account_id, account_name, is_active')
    .eq('is_active', true)

  if (connError) {
    console.log('❌ Erro ao buscar conexões:', connError.message)
  } else {
    console.log(`✅ Encontradas ${connections?.length || 0} conexões ativas`)
    if (connections && connections.length > 0) {
      connections.forEach(conn => {
        console.log(`   - ${conn.account_name} (${conn.ad_account_id})`)
      })
    }
  }

  // 3. Verificar saldos existentes
  console.log('\n📊 3. VERIFICANDO SALDOS EXISTENTES...\n')
  
  const { data: balances, error: balError } = await supabase
    .from('ad_account_balances')
    .select('*')
    .order('last_checked_at', { ascending: false })

  if (balError) {
    console.log('❌ Erro ao buscar saldos:', balError.message)
  } else {
    console.log(`✅ Encontrados ${balances?.length || 0} registros de saldo`)
    if (balances && balances.length > 0) {
      balances.forEach(bal => {
        console.log(`   - ${bal.ad_account_name}: ${bal.currency} ${bal.balance} (${bal.status})`)
        console.log(`     Última verificação: ${new Date(bal.last_checked_at).toLocaleString('pt-BR')}`)
      })
    }
  }

  // 4. Verificar alertas configurados
  console.log('\n📊 4. VERIFICANDO ALERTAS...\n')
  
  const { data: alerts, error: alertError } = await supabase
    .from('balance_alerts')
    .select('*')
    .eq('is_active', true)

  if (alertError) {
    console.log('❌ Erro ao buscar alertas:', alertError.message)
  } else {
    console.log(`✅ Encontrados ${alerts?.length || 0} alertas ativos`)
    if (alerts && alerts.length > 0) {
      alerts.forEach(alert => {
        console.log(`   - ${alert.ad_account_name}: ${alert.alert_type}`)
        console.log(`     Threshold: ${alert.threshold_amount}`)
        console.log(`     Saldo atual: ${alert.current_balance || 'N/A'}`)
      })
    }
  }

  // 5. Verificar histórico de alertas
  console.log('\n📊 5. VERIFICANDO HISTÓRICO DE ALERTAS...\n')
  
  const { data: history, error: histError } = await supabase
    .from('alert_history')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(10)

  if (histError) {
    console.log('❌ Erro ao buscar histórico:', histError.message)
  } else {
    console.log(`✅ Encontrados ${history?.length || 0} registros de histórico`)
    if (history && history.length > 0) {
      history.forEach(h => {
        console.log(`   - ${new Date(h.sent_at).toLocaleString('pt-BR')}: ${h.sent_via} - ${h.status}`)
        console.log(`     Para: ${h.recipient}`)
      })
    }
  }

  // 6. Verificar configuração WhatsApp
  console.log('\n📊 6. VERIFICANDO CONFIGURAÇÃO WHATSAPP...\n')
  
  const { data: whatsapp, error: whatsappError } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('is_active', true)

  if (whatsappError) {
    console.log('❌ Erro ao buscar config WhatsApp:', whatsappError.message)
  } else {
    console.log(`✅ Encontradas ${whatsapp?.length || 0} configurações WhatsApp`)
    if (whatsapp && whatsapp.length > 0) {
      whatsapp.forEach(w => {
        console.log(`   - Instance: ${w.instance_name}`)
        console.log(`     URL: ${w.evolution_api_url}`)
        console.log(`     Telefone: ${w.phone_number}`)
      })
    }
  }

  // 7. Resumo final
  console.log('\n' + '='.repeat(60))
  console.log('\n📋 RESUMO DO SISTEMA DE SALDO\n')
  
  const summary = {
    'Tabelas criadas': tables.length,
    'Conexões Meta ativas': connections?.length || 0,
    'Saldos registrados': balances?.length || 0,
    'Alertas ativos': alerts?.length || 0,
    'Histórico de alertas': history?.length || 0,
    'Config WhatsApp': whatsapp?.length || 0
  }

  Object.entries(summary).forEach(([key, value]) => {
    console.log(`${key}: ${value}`)
  })

  // Status geral
  const hasConnections = (connections?.length || 0) > 0
  const hasBalances = (balances?.length || 0) > 0
  const hasAlerts = (alerts?.length || 0) > 0

  console.log('\n📊 STATUS GERAL:')
  if (hasConnections && hasBalances) {
    console.log('✅ Sistema de saldo FUNCIONANDO')
    console.log('   - Conexões Meta configuradas')
    console.log('   - Saldos sendo monitorados')
    if (hasAlerts) {
      console.log('   - Alertas configurados')
    } else {
      console.log('   ⚠️  Nenhum alerta configurado ainda')
    }
  } else if (hasConnections && !hasBalances) {
    console.log('⚠️  Sistema PARCIALMENTE configurado')
    console.log('   - Conexões Meta OK')
    console.log('   - Saldos NÃO sincronizados ainda')
    console.log('   💡 Execute: POST /api/balance/sync')
  } else {
    console.log('❌ Sistema NÃO configurado')
    console.log('   - Nenhuma conexão Meta encontrada')
    console.log('   💡 Conecte uma conta Meta primeiro')
  }

  console.log('\n' + '='.repeat(60))
}

// Executar teste
testBalanceSystem()
  .then(() => {
    console.log('\n✅ Teste concluído!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Erro no teste:', error)
    process.exit(1)
  })
