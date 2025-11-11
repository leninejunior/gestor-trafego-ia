/**
 * Script para Verificar Contas Meta e Testar API de Saldo
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verificarContas() {
  console.log('🔍 Verificando Contas Meta Ads...\n')

  try {
    // 1. Verificar conexões Meta
    console.log('1️⃣ Buscando conexões Meta...')
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

    if (connError) {
      console.error('❌ Erro:', connError.message)
      return
    }

    console.log(`✅ Encontradas ${connections?.length || 0} conexões ativas\n`)

    if (!connections || connections.length === 0) {
      console.log('⚠️  Nenhuma conexão Meta ativa encontrada!')
      console.log('\n📝 Para ver dados de saldo, você precisa:')
      console.log('   1. Conectar uma conta Meta Ads')
      console.log('   2. Ir em /dashboard/clients/[clientId]')
      console.log('   3. Clicar em "Conectar Meta Ads"')
      console.log('   4. Autorizar e selecionar contas')
      return
    }

    // 2. Mostrar contas conectadas
    console.log('📊 Contas Conectadas:')
    connections.forEach((conn, i) => {
      console.log(`\n${i + 1}. Cliente: ${conn.clients?.name}`)
      console.log(`   Connection ID: ${conn.id}`)
      console.log(`   Ad Accounts: ${conn.selected_ad_account_ids?.length || 0}`)
      
      if (conn.selected_ad_account_ids) {
        conn.selected_ad_account_ids.forEach(accId => {
          console.log(`      - ${accId}`)
        })
      }
    })

    // 3. Testar API de saldo
    console.log('\n\n3️⃣ Testando API de saldo...')
    console.log('   Fazendo requisição para /api/admin/balance/accounts')
    
    // Simular o que a API faria
    console.log('\n   ⚠️  NOTA: A API precisa de tokens válidos do Meta')
    console.log('   Se os tokens expiraram, você verá saldo = 0')
    
    // 4. Verificar tabela de alertas
    console.log('\n\n4️⃣ Verificando tabela de alertas...')
    const { data: alerts, error: alertsError } = await supabase
      .from('balance_alerts')
      .select('*')
      .limit(5)

    if (alertsError) {
      console.error('❌ Erro:', alertsError.message)
    } else {
      console.log(`✅ Tabela balance_alerts existe`)
      console.log(`   Total de alertas: ${alerts?.length || 0}`)
    }

    // 5. Instruções
    console.log('\n\n📋 Próximos Passos:')
    console.log('   1. Acesse: http://localhost:3000/admin/balance')
    console.log('   2. Clique em "Atualizar" para buscar saldos')
    console.log('   3. Se não aparecer nada:')
    console.log('      - Verifique se os tokens Meta estão válidos')
    console.log('      - Reconecte a conta Meta se necessário')
    console.log('      - Verifique o console do navegador para erros')

  } catch (error) {
    console.error('❌ Erro:', error)
  }
}

verificarContas()
