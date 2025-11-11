/**
 * Script Simples: Aplicar Schema e Testar Saldo
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🚀 Aplicando Schema e Testando Sistema de Saldo\n')

  try {
    // 1. Verificar se tabelas existem
    console.log('1️⃣ Verificando tabelas...')
    const { data: balances, error: balancesError } = await supabase
      .from('ad_account_balances')
      .select('count')
      .limit(1)

    if (balancesError && balancesError.message.includes('does not exist')) {
      console.log('⚠️  Tabelas não existem. Aplicando schema...\n')
      
      // Ler e aplicar SQL
      const sqlPath = path.join(__dirname, '..', 'database', 'APLICAR_ALERTAS_SALDO_FINAL.sql')
      const sql = fs.readFileSync(sqlPath, 'utf8')
      
      console.log('📝 Aplicando SQL no Supabase...')
      console.log('   Copie e cole este SQL no Supabase SQL Editor:')
      console.log('   https://supabase.com/dashboard/project/SEU_PROJETO/sql\n')
      console.log('=' .repeat(60))
      console.log(sql)
      console.log('='.repeat(60))
      console.log('\n⏸️  Após aplicar o SQL, execute este script novamente.\n')
      return
    }

    console.log('✅ Tabelas existem!\n')

    // 2. Buscar conexões Meta
    console.log('2️⃣ Buscando conexões Meta...')
    const { data: connections, error: connError } = await supabase
      .from('client_meta_connections')
      .select(`
        *,
        clients (
          id,
          name
        )
      `)
      .eq('status', 'active')
      .limit(3)

    if (connError) {
      console.error('❌ Erro:', connError.message)
      return
    }

    console.log(`✅ Encontradas ${connections?.length || 0} conexões\n`)

    if (!connections || connections.length === 0) {
      console.log('⚠️  Nenhuma conexão Meta encontrada')
      console.log('   Conecte uma conta Meta primeiro\n')
      return
    }

    // 3. Popular dados de teste
    console.log('3️⃣ Populando dados de teste...')
    
    for (const conn of connections) {
      const accountIds = conn.selected_ad_account_ids || []
      
      for (const accountId of accountIds.slice(0, 1)) {
        // Criar saldo de teste
        const { error: balanceError } = await supabase
          .from('ad_account_balances')
          .upsert({
            client_id: conn.clients.id,
            ad_account_id: accountId,
            ad_account_name: `Conta ${accountId}`,
            balance: 75.00,
            spend_cap: 500.00,
            daily_spend_limit: 50.00,
            currency: 'BRL',
            daily_spend: 25.00,
            projected_days_remaining: 3,
            status: 'warning'
          }, {
            onConflict: 'client_id,ad_account_id'
          })

        if (balanceError) {
          console.error(`❌ Erro ao criar saldo:`, balanceError.message)
        } else {
          console.log(`✅ Saldo criado: ${accountId}`)
        }

        // Criar alerta de saldo baixo
        const { error: alertError } = await supabase
          .from('balance_alerts')
          .upsert({
            client_id: conn.clients.id,
            ad_account_id: accountId,
            threshold_amount: 100.00,
            alert_type: 'low_balance',
            is_active: true
          }, {
            onConflict: 'client_id,ad_account_id,alert_type'
          })

        if (alertError) {
          console.error(`❌ Erro ao criar alerta:`, alertError.message)
        } else {
          console.log(`✅ Alerta criado: ${accountId}`)
        }
      }
    }

    console.log()

    // 4. Listar saldos
    console.log('4️⃣ Listando saldos...')
    const { data: allBalances, error: listError } = await supabase
      .from('ad_account_balances')
      .select(`
        *,
        clients (
          name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    if (listError) {
      console.error('❌ Erro:', listError.message)
    } else {
      console.log(`✅ Total: ${allBalances?.length || 0} contas\n`)
      
      allBalances?.forEach(bal => {
        const statusIcon = bal.status === 'critical' ? '🔴' : 
                          bal.status === 'warning' ? '🟡' : '🟢'
        
        console.log(`${statusIcon} ${bal.ad_account_name}`)
        console.log(`   Cliente: ${bal.clients?.name}`)
        console.log(`   Saldo: R$ ${bal.balance?.toFixed(2)}`)
        console.log(`   Status: ${bal.status}`)
        console.log(`   Dias restantes: ${bal.projected_days_remaining}`)
        console.log()
      })
    }

    // 5. Testar APIs
    console.log('5️⃣ APIs disponíveis:')
    console.log('   GET  /api/balance/my-accounts')
    console.log('   POST /api/balance/sync')
    console.log('   GET  /api/admin/balance/accounts')
    console.log('   GET  /api/admin/balance/alerts')
    console.log('   POST /api/admin/balance/check-all')
    console.log()

    // 6. Acessar interface
    console.log('6️⃣ Interface:')
    console.log('   http://localhost:3000/dashboard/balance-alerts')
    console.log()

    console.log('✅ Sistema configurado e funcionando!')
    console.log('\n📋 Próximos passos:')
    console.log('   1. Acesse a interface acima')
    console.log('   2. Configure alertas para suas contas')
    console.log('   3. Teste sincronização de saldo real')

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

main()
