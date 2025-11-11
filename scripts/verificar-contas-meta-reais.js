/**
 * Verificar contas Meta conectadas e testar tokens
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 Verificando contas Meta conectadas...\n')

  try {
    // Buscar conexões
    const { data: connections, error } = await supabase
      .from('client_meta_connections')
      .select(`
        *,
        clients (
          id,
          name
        )
      `)

    if (error) {
      console.error('❌ Erro:', error.message)
      return
    }

    console.log(`📊 Total de conexões: ${connections?.length || 0}\n`)

    if (!connections || connections.length === 0) {
      console.log('⚠️  Nenhuma conexão encontrada')
      console.log('   Conecte uma conta Meta primeiro em /dashboard/clients')
      return
    }

    // Verificar cada conexão
    for (const conn of connections) {
      console.log(`\n📱 Conexão: ${conn.clients?.name}`)
      console.log(`   Status: ${conn.status}`)
      console.log(`   Contas: ${conn.selected_ad_account_ids?.length || 0}`)
      console.log(`   Token: ${conn.access_token ? 'Presente' : 'Ausente'}`)
      
      if (conn.selected_ad_account_ids && conn.selected_ad_account_ids.length > 0) {
        console.log(`   IDs: ${conn.selected_ad_account_ids.join(', ')}`)
        
        // Testar token com primeira conta
        if (conn.access_token) {
          const accountId = conn.selected_ad_account_ids[0]
          console.log(`\n   🧪 Testando token com ${accountId}...`)
          
          try {
            const url = `https://graph.facebook.com/v18.0/${accountId}?fields=name,balance&access_token=${conn.access_token}`
            const response = await fetch(url)
            
            if (response.ok) {
              const data = await response.json()
              console.log(`   ✅ Token válido!`)
              console.log(`      Nome: ${data.name}`)
              console.log(`      Saldo: R$ ${(parseFloat(data.balance || '0') / 100).toFixed(2)}`)
            } else {
              const error = await response.json()
              console.log(`   ❌ Token inválido ou expirado`)
              console.log(`      Erro: ${error.error?.message || 'Unknown'}`)
            }
          } catch (err) {
            console.log(`   ❌ Erro ao testar: ${err.message}`)
          }
        }
      }
    }

    console.log('\n\n📋 Resumo:')
    const activeConns = connections.filter(c => c.status === 'active')
    const withAccounts = connections.filter(c => c.selected_ad_account_ids?.length > 0)
    const withTokens = connections.filter(c => c.access_token)

    console.log(`   Total: ${connections.length}`)
    console.log(`   Ativas: ${activeConns.length}`)
    console.log(`   Com contas: ${withAccounts.length}`)
    console.log(`   Com tokens: ${withTokens.length}`)

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

main()
