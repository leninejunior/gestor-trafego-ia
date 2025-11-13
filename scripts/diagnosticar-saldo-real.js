/**
 * Diagnosticar problema de saldo não aparecer
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function diagnosticar() {
  console.log('🔍 Diagnosticando sistema de saldo...\n')

  try {
    // 1. Verificar tabela client_meta_connections
    console.log('1️⃣ Verificando tabela client_meta_connections...')
    const { data: connections, error: connError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('is_active', true)

    if (connError) {
      console.error('❌ Erro:', connError.message)
      console.log('\n⚠️  Tabela client_meta_connections não existe ou tem problema')
      console.log('   Vamos verificar meta_connections...\n')
      
      // Tentar meta_connections
      const { data: metaConn, error: metaError } = await supabase
        .from('meta_connections')
        .select('*')
        .eq('status', 'active')
      
      if (metaError) {
        console.error('❌ Erro meta_connections:', metaError.message)
      } else {
        console.log(`✅ Encontradas ${metaConn?.length || 0} conexões em meta_connections`)
        
        if (metaConn && metaConn.length > 0) {
          console.log('\n📋 Estrutura da primeira conexão:')
          console.log(JSON.stringify(metaConn[0], null, 2))
        }
      }
    } else {
      console.log(`✅ Encontradas ${connections?.length || 0} conexões`)
      
      if (connections && connections.length > 0) {
        console.log('\n📋 Primeira conexão:')
        console.log(JSON.stringify(connections[0], null, 2))
      }
    }

    // 2. Verificar tabela ad_account_balances
    console.log('\n2️⃣ Verificando tabela ad_account_balances...')
    const { data: balances, error: balError } = await supabase
      .from('ad_account_balances')
      .select('*')

    if (balError) {
      console.error('❌ Erro:', balError.message)
      console.log('   Tabela ad_account_balances não existe!')
    } else {
      console.log(`✅ Encontrados ${balances?.length || 0} saldos salvos`)
      
      if (balances && balances.length > 0) {
        console.log('\n📋 Primeiro saldo:')
        console.log(JSON.stringify(balances[0], null, 2))
      }
    }

    // 3. Verificar clientes
    console.log('\n3️⃣ Verificando clientes...')
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name')
      .limit(5)

    if (clientsError) {
      console.error('❌ Erro:', clientsError.message)
    } else {
      console.log(`✅ Encontrados ${clients?.length || 0} clientes`)
      clients?.forEach(c => {
        console.log(`   - ${c.name} (${c.id})`)
      })
    }

    // 4. Testar API de sincronização
    console.log('\n4️⃣ Testando API de sincronização...')
    console.log('   POST /api/balance/sync')
    console.log('   (Execute manualmente ou aguarde...)\n')

    // 5. Verificar estrutura das tabelas
    console.log('5️⃣ Verificando estrutura das tabelas...')
    
    // Tentar descobrir qual tabela de conexões Meta existe
    const tables = ['client_meta_connections', 'meta_connections', 'meta_ad_accounts']
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)
      
      if (!error && data) {
        console.log(`\n✅ Tabela ${table} existe!`)
        if (data.length > 0) {
          console.log('   Colunas:', Object.keys(data[0]).join(', '))
        }
      }
    }

    console.log('\n📊 Resumo do Diagnóstico:')
    console.log('=' .repeat(50))
    
    // Determinar qual tabela usar
    const { data: metaConnCheck } = await supabase
      .from('meta_connections')
      .select('*')
      .eq('status', 'active')
      .limit(1)
    
    if (metaConnCheck && metaConnCheck.length > 0) {
      console.log('✅ Usar tabela: meta_connections')
      console.log('✅ Campo de status: status = "active"')
      console.log('✅ Campo de conta: selected_ad_account_ids (array)')
    } else {
      console.log('⚠️  Nenhuma conexão Meta ativa encontrada')
    }

    console.log('\n🔧 Próximos passos:')
    console.log('1. Corrigir API de sincronização para usar tabela correta')
    console.log('2. Executar sincronização manual')
    console.log('3. Verificar se saldos aparecem')

  } catch (error) {
    console.error('❌ Erro:', error)
  }
}

diagnosticar()
