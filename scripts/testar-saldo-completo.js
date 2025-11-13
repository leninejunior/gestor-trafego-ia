/**
 * Script para testar o sistema de saldo completo
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testarSistema() {
  console.log('🔍 Testando sistema de saldo completo...\n')

  try {
    // 1. Verificar conexões Meta
    console.log('1️⃣ Verificando conexões Meta...')
    const { data: connections, error: connError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('is_active', true)

    if (connError) {
      console.error('❌ Erro ao buscar conexões:', connError)
      return
    }

    console.log(`✅ Encontradas ${connections?.length || 0} conexões ativas\n`)

    if (!connections || connections.length === 0) {
      console.log('⚠️ Nenhuma conexão Meta encontrada')
      console.log('💡 Conecte uma conta Meta Ads primeiro\n')
      return
    }

    // 2. Criar dados de teste de saldo
    console.log('2️⃣ Criando dados de teste de saldo...')
    
    for (const conn of connections) {
      const testBalance = {
        client_id: conn.client_id,
        ad_account_id: conn.ad_account_id,
        ad_account_name: conn.account_name || `Conta ${conn.ad_account_id}`,
        balance: 5000.00,
        account_spend_limit: 10000.00,
        currency: 'BRL',
        daily_spend: 150.00,
        status: 'healthy',
        last_checked_at: new Date().toISOString()
      }

      const { error: upsertError } = await supabase
        .from('ad_account_balances')
        .upsert(testBalance)

      if (upsertError) {
        console.error(`❌ Erro ao criar saldo para ${conn.ad_account_id}:`, upsertError)
      } else {
        console.log(`✅ Saldo criado: ${conn.ad_account_id} - R$ ${testBalance.balance}`)
      }
    }

    // 3. Verificar dados criados
    console.log('\n3️⃣ Verificando dados criados...')
    const { data: balances, error: balError } = await supabase
      .from('ad_account_balances')
      .select('*')

    if (balError) {
      console.error('❌ Erro ao buscar saldos:', balError)
      return
    }

    console.log(`✅ Total de saldos no banco: ${balances?.length || 0}\n`)

    if (balances && balances.length > 0) {
      console.log('📊 Detalhes dos saldos:')
      balances.forEach((bal, index) => {
        console.log(`\n   ${index + 1}. ${bal.ad_account_name}`)
        console.log(`      - Saldo: R$ ${bal.balance}`)
        console.log(`      - Status: ${bal.status}`)
        console.log(`      - Gasto diário: R$ ${bal.daily_spend}`)
        console.log(`      - Dias restantes: ${bal.projected_days_remaining}`)
      })
    }

    console.log('\n✅ Teste concluído com sucesso!')
    console.log('\n💡 Acesse as páginas:')
    console.log('   - Dashboard: http://localhost:3000/dashboard')
    console.log('   - Saldo das Contas: http://localhost:3000/dashboard/balance')

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

testarSistema()
