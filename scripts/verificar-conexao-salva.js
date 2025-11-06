/**
 * Verificar se a conexão foi salva corretamente no banco
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarConexaoSalva() {
  console.log('🔍 Verificando conexões salvas...\n');

  try {
    // Buscar todas as conexões
    const { data: connections, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar conexões:', error);
      return;
    }

    console.log(`📋 ${connections.length} conexões encontradas:\n`);

    connections.forEach((conn, index) => {
      console.log(`${index + 1}. ID: ${conn.id}`);
      console.log(`   Client ID: ${conn.client_id}`);
      console.log(`   Customer ID: ${conn.customer_id}`);
      console.log(`   Status: ${conn.status}`);
      console.log(`   Atualizado: ${new Date(conn.updated_at).toLocaleString()}`);
      
      // Verificar se tem contas selecionadas
      if (conn.selected_accounts) {
        try {
          const accounts = JSON.parse(conn.selected_accounts);
          console.log(`   ✅ Contas selecionadas: ${accounts.length}`);
          accounts.forEach(acc => {
            console.log(`      - ${acc.descriptiveName} (${acc.customerId})`);
          });
        } catch (e) {
          console.log(`   ❌ Erro ao parsear contas: ${conn.selected_accounts}`);
        }
      } else {
        console.log(`   ⚠️  Sem contas selecionadas`);
      }
      
      console.log('');
    });

    // Verificar conexões com contas selecionadas
    const connectionsWithAccounts = connections.filter(conn => 
      conn.selected_accounts && conn.selected_accounts !== 'null'
    );

    if (connectionsWithAccounts.length > 0) {
      console.log(`✅ ${connectionsWithAccounts.length} conexões com contas selecionadas encontradas!`);
    } else {
      console.log('❌ Nenhuma conexão com contas selecionadas encontrada');
    }

  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

verificarConexaoSalva().catch(console.error);