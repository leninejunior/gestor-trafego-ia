/**
 * Verificar estrutura da tabela google_ads_connections
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarEstrutura() {
  console.log('🔍 Verificando estrutura da tabela google_ads_connections...\n');

  try {
    // Buscar uma conexão para ver as colunas disponíveis
    const { data, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Erro ao buscar dados:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('📋 Colunas disponíveis na tabela:');
      const columns = Object.keys(data[0]);
      columns.forEach((col, index) => {
        console.log(`   ${index + 1}. ${col}`);
      });

      console.log('\n📄 Exemplo de registro:');
      console.log(JSON.stringify(data[0], null, 2));

      // Verificar se tem coluna selected_accounts
      if (columns.includes('selected_accounts')) {
        console.log('\n✅ Coluna "selected_accounts" existe!');
      } else {
        console.log('\n❌ Coluna "selected_accounts" NÃO existe!');
        console.log('   Isso explica por que as contas selecionadas não estão sendo salvas.');
      }
    } else {
      console.log('❌ Nenhum registro encontrado na tabela');
    }

  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

verificarEstrutura().catch(console.error);