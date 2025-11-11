/**
 * Limpar dados mockados e sincronizar saldo REAL
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🧹 Limpando dados mockados e sincronizando saldo REAL...\n')

  try {
    // 1. Limpar dados mockados
    console.log('1️⃣ Limpando dados mockados...')
    const { error: deleteError } = await supabase
      .from('ad_account_balances')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Deleta tudo

    if (deleteError) {
      console.error('❌ Erro ao limpar:', deleteError.message)
    } else {
      console.log('✅ Dados mockados removidos\n')
    }

    // 2. Sincronizar saldo REAL
    console.log('2️⃣ Sincronizando saldo REAL do Meta Ads...')
    const response = await fetch('http://localhost:3000/api/balance/sync', {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.statusText}`)
    }

    const data = await response.json()
    console.log('✅ Sincronização concluída!')
    console.log(`   Contas sincronizadas: ${data.synced}`)
    console.log(`   Erros: ${data.errors}\n`)

    // 3. Verificar dados reais
    console.log('3️⃣ Verificando dados reais...')
    const { data: balances, error: balancesError } = await supabase
      .from('ad_account_balances')
      .select(`
        *,
        clients (
          name
        )
      `)
      .order('balance', { ascending: true })

    if (balancesError) {
      console.error('❌ Erro:', balancesError.message)
    } else {
      console.log(`✅ Total: ${balances?.length || 0} contas REAIS\n`)
      
      balances?.forEach(bal => {
        const statusIcon = bal.status === 'critical' ? '🔴' : 
                          bal.status === 'warning' ? '🟡' : '🟢'
        
        console.log(`${statusIcon} ${bal.ad_account_name}`)
        console.log(`   Cliente: ${bal.clients?.name}`)
        console.log(`   Saldo: R$ ${bal.balance?.toFixed(2)}`)
        console.log(`   Status: ${bal.status}`)
        console.log()
      })
    }

    console.log('✅ Pronto! Agora você tem apenas dados REAIS do Meta Ads')
    console.log('\n📱 Acesse: http://localhost:3000/dashboard/balance-alerts')

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

main()
