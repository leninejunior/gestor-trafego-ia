/**
 * Debug do erro 500 na sincronização
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debug() {
  console.log('🔍 Debugando erro 500...\n')

  try {
    // 1. Verificar conexões Meta
    console.log('1️⃣ Buscando conexões Meta...')
    const { data: connections, error: connError } = await supabase
      .from('meta_connections')
      .select(`
        *,
        clients (
          id,
          name
        )
      `)
      .eq('status', 'active')

    if (connError) {
      console.error('❌ Erro:', connError)
      return
    }

    console.log(`✅ Encontradas ${connections?.length || 0} conexões\n`)

    if (!connections || connections.length === 0) {
      console.log('⚠️  Nenhuma conexão ativa')
      return
    }

    // 2. Verificar estrutura de cada conexão
    for (const conn of connections) {
      console.log(`\n📋 Conexão ${conn.id}:`)
      console.log(`   Client ID: ${conn.client_id}`)
      console.log(`   Client Name: ${conn.clients?.name || 'N/A'}`)
      console.log(`   Status: ${conn.status}`)
      console.log(`   Access Token: ${conn.access_token ? 'Presente' : 'AUSENTE'}`)
      console.log(`   Selected Accounts: ${JSON.stringify(conn.selected_ad_account_ids)}`)
      
      // Verificar se selected_ad_account_ids é array
      if (conn.selected_ad_account_ids) {
        if (Array.isArray(conn.selected_ad_account_ids)) {
          console.log(`   ✅ É array com ${conn.selected_ad_account_ids.length} contas`)
        } else {
          console.log(`   ⚠️  NÃO é array! Tipo: ${typeof conn.selected_ad_account_ids}`)
        }
      } else {
        console.log(`   ❌ selected_ad_account_ids é null/undefined`)
      }
    }

    // 3. Testar busca de saldo de uma conta
    console.log('\n\n3️⃣ Testando busca de saldo...')
    const firstConn = connections[0]
    const accountIds = firstConn.selected_ad_account_ids || []
    
    if (accountIds.length > 0) {
      const accountId = accountIds[0]
      console.log(`   Testando conta: ${accountId}`)
      
      try {
        const url = `https://graph.facebook.com/v18.0/${accountId}?fields=name,currency,balance&access_token=${firstConn.access_token}`
        const response = await fetch(url)
        const data = await response.json()
        
        if (response.ok) {
          console.log('   ✅ Sucesso!')
          console.log(`   Nome: ${data.name}`)
          console.log(`   Moeda: ${data.currency}`)
          console.log(`   Saldo: ${data.balance}`)
        } else {
          console.log('   ❌ Erro da API Meta:')
          console.log(JSON.stringify(data, null, 2))
        }
      } catch (error) {
        console.error('   ❌ Erro:', error.message)
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error)
  }
}

debug()
