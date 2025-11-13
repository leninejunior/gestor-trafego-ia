/**
 * Script para testar sincronização de saldos das contas Meta
 */

const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function testarSincronizacao() {
  console.log('🔄 Testando sincronização de saldos...\n')

  try {
    // 1. Sincronizar saldos
    console.log('1️⃣ Sincronizando saldos das contas Meta...')
    const syncResponse = await fetch(`${NEXT_PUBLIC_APP_URL}/api/balance/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!syncResponse.ok) {
      const error = await syncResponse.text()
      console.error('❌ Erro ao sincronizar:', error)
      return
    }

    const syncResult = await syncResponse.json()
    console.log('✅ Sincronização concluída:')
    console.log(`   - Contas sincronizadas: ${syncResult.synced}`)
    console.log(`   - Erros: ${syncResult.errors}`)
    console.log(`   - Mensagem: ${syncResult.message}\n`)

    // 2. Buscar saldos sincronizados
    console.log('2️⃣ Buscando saldos das contas...')
    const balancesResponse = await fetch(`${NEXT_PUBLIC_APP_URL}/api/balance/my-accounts`)

    if (!balancesResponse.ok) {
      const error = await balancesResponse.text()
      console.error('❌ Erro ao buscar saldos:', error)
      return
    }

    const balancesData = await balancesResponse.json()
    console.log('✅ Saldos encontrados:')
    console.log(`   - Total de contas: ${balancesData.summary.total_accounts}`)
    console.log(`   - Saldo total: R$ ${balancesData.summary.total_balance.toFixed(2)}`)
    console.log(`   - Contas críticas: ${balancesData.summary.critical_accounts}`)
    console.log(`   - Contas com aviso: ${balancesData.summary.warning_accounts}`)
    console.log(`   - Contas saudáveis: ${balancesData.summary.healthy_accounts}\n`)

    if (balancesData.balances && balancesData.balances.length > 0) {
      console.log('📊 Detalhes das contas:')
      balancesData.balances.forEach((account, index) => {
        console.log(`\n   ${index + 1}. ${account.ad_account_name}`)
        console.log(`      - ID: ${account.ad_account_id}`)
        console.log(`      - Cliente: ${account.client_name}`)
        console.log(`      - Saldo: R$ ${account.balance.toFixed(2)}`)
        console.log(`      - Status: ${account.status}`)
        console.log(`      - Gasto diário: R$ ${account.daily_spend.toFixed(2)}`)
        if (account.estimated_days_remaining < 999) {
          console.log(`      - Dias restantes: ~${Math.floor(account.estimated_days_remaining)}`)
        }
      })
    }

    console.log('\n✅ Teste concluído com sucesso!')
    console.log('\n💡 Acesse o dashboard para ver o widget de saldos:')
    console.log(`   ${NEXT_PUBLIC_APP_URL}/dashboard`)

  } catch (error) {
    console.error('❌ Erro no teste:', error.message)
  }
}

// Executar teste
testarSincronizacao()
