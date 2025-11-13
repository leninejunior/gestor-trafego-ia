/**
 * Verificar estrutura da tabela client_meta_connections
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verificar() {
  console.log('🔍 Verificando estrutura...\n')

  try {
    const { data, error } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('is_active', true)
      .limit(5)

    if (error) {
      console.error('❌ Erro:', error)
      return
    }

    console.log(`✅ Encontradas ${data?.length || 0} conexões ativas\n`)

    if (data && data.length > 0) {
      console.log('📋 Estrutura da primeira conexão:')
      const first = data[0]
      console.log('Colunas:', Object.keys(first).join(', '))
      console.log('\nDados:')
      console.log(JSON.stringify(first, null, 2))
    }

  } catch (error) {
    console.error('❌ Erro:', error)
  }
}

verificar()
