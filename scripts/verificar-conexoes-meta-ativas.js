/**
 * Script para verificar conexões Meta ativas no banco
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

async function verificarConexoes() {
  console.log('🔍 Verificando conexões Meta ativas...\n')

  try {
    // Buscar conexões ativas
    const { data: connections, error } = await supabase
      .from('client_meta_connections')
      .select(`
        *,
        clients (
          id,
          name
        )
      `)
      .eq('is_active', true)

    if (error) {
      console.error('❌ Erro ao buscar conexões:', error)
      return
    }

    console.log(`✅ Encontradas ${connections?.length || 0} conexões ativas\n`)

    if (connections && connections.length > 0) {
      connections.forEach((conn, index) => {
        console.log(`${index + 1}. Conexão ID: ${conn.id}`)
        console.log(`   - Cliente: ${conn.clients?.name || 'N/A'}`)
        console.log(`   - Ad Account ID: ${conn.ad_account_id}`)
        console.log(`   - Account Name: ${conn.account_name || 'N/A'}`)
        console.log(`   - Ativa: ${conn.is_active}`)
        console.log(`   - Criada em: ${new Date(conn.created_at).toLocaleString('pt-BR')}`)
        console.log('')
      })
    } else {
      console.log('⚠️ Nenhuma conexão Meta ativa encontrada')
      console.log('\n💡 Para testar o sistema de saldos:')
      console.log('   1. Conecte uma conta Meta Ads')
      console.log('   2. Execute este script novamente')
    }

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

verificarConexoes()
