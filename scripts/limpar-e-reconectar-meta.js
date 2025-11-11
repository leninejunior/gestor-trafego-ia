/**
 * Limpar conexões Meta antigas e preparar para reconexão
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🧹 Limpando conexões Meta antigas...\n')

  try {
    // Listar conexões atuais
    const { data: connections, error } = await supabase
      .from('client_meta_connections')
      .select(`
        *,
        clients (
          name
        )
      `)

    if (error) {
      console.error('❌ Erro:', error.message)
      return
    }

    console.log(`📊 Conexões encontradas: ${connections?.length || 0}\n`)

    if (!connections || connections.length === 0) {
      console.log('✅ Nenhuma conexão para limpar')
      return
    }

    // Mostrar conexões
    connections.forEach((conn, i) => {
      console.log(`${i + 1}. ${conn.clients?.name}`)
      console.log(`   ID: ${conn.id}`)
      console.log(`   Status: ${conn.status}`)
      console.log(`   Contas: ${conn.selected_ad_account_ids?.length || 0}`)
      console.log(`   Token: ${conn.access_token ? 'Presente' : 'Ausente'}`)
      console.log()
    })

    // Perguntar se quer deletar
    console.log('⚠️  ATENÇÃO: Isso vai deletar TODAS as conexões Meta!')
    console.log('   Você precisará reconectar manualmente depois.\n')
    console.log('Para continuar, execute:')
    console.log('   node scripts/limpar-e-reconectar-meta.js --confirmar\n')

    // Verificar se tem flag de confirmação
    if (!process.argv.includes('--confirmar')) {
      console.log('❌ Operação cancelada (adicione --confirmar para executar)')
      return
    }

    // Deletar todas as conexões
    console.log('🗑️  Deletando conexões...')
    const { error: deleteError } = await supabase
      .from('client_meta_connections')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (deleteError) {
      console.error('❌ Erro ao deletar:', deleteError.message)
      return
    }

    console.log('✅ Todas as conexões foram removidas!\n')

    // Limpar dados de saldo também
    console.log('🧹 Limpando dados de saldo...')
    const { error: balanceError } = await supabase
      .from('ad_account_balances')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (balanceError) {
      console.error('⚠️  Erro ao limpar saldos:', balanceError.message)
    } else {
      console.log('✅ Dados de saldo limpos\n')
    }

    console.log('✅ Limpeza concluída!\n')
    console.log('📋 Próximos passos:')
    console.log('   1. Acesse: http://localhost:3000/dashboard/clients')
    console.log('   2. Clique em um cliente')
    console.log('   3. Clique em "Conectar Meta Ads"')
    console.log('   4. Autorize no Facebook')
    console.log('   5. Selecione as contas e páginas')
    console.log('   6. Salve')
    console.log('\n   Agora a página de seleção deve funcionar! 🎉')

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

main()
