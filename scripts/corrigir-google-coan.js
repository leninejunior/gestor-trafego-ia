/**
 * Script de Correção - Conexões Google Ads do Cliente COAN
 * 
 * 1. Remove conexões duplicadas (mantém a mais recente de cada Customer ID)
 * 2. Remove conexões revogadas
 * 3. Prepara para sincronização de campanhas
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function corrigir() {
  console.log('='.repeat(80));
  console.log('CORREÇÃO: Conexões Google Ads - Cliente COAN');
  console.log('='.repeat(80));
  console.log('');

  const clientId = 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751';

  // 1. Buscar todas as conexões
  console.log('1️⃣ BUSCANDO CONEXÕES...');
  const { data: connections, error: connectionsError } = await supabase
    .from('google_ads_connections')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (connectionsError) {
    console.error('❌ Erro:', connectionsError);
    return;
  }

  console.log(`✅ Encontradas ${connections.length} conexões`);
  console.log('');

  // 2. Identificar conexões a manter e remover
  console.log('2️⃣ ANALISANDO CONEXÕES...');
  
  const toKeep = [];
  const toRemove = [];
  const seenCustomerIds = new Set();

  // Primeiro, processar conexões ativas
  connections
    .filter(c => c.status === 'active')
    .forEach(conn => {
      if (!seenCustomerIds.has(conn.customer_id)) {
        toKeep.push(conn);
        seenCustomerIds.add(conn.customer_id);
        console.log(`✅ MANTER: ${conn.id.substring(0, 8)}... (Customer: ${conn.customer_id}, Status: ${conn.status})`);
      } else {
        toRemove.push(conn);
        console.log(`❌ REMOVER: ${conn.id.substring(0, 8)}... (Customer: ${conn.customer_id}, Status: ${conn.status}) - DUPLICATA`);
      }
    });

  // Depois, marcar conexões revogadas para remoção
  connections
    .filter(c => c.status === 'revoked')
    .forEach(conn => {
      toRemove.push(conn);
      console.log(`❌ REMOVER: ${conn.id.substring(0, 8)}... (Customer: ${conn.customer_id}, Status: ${conn.status}) - REVOGADA`);
    });

  console.log('');
  console.log(`📊 Resumo:`);
  console.log(`   - Conexões a manter: ${toKeep.length}`);
  console.log(`   - Conexões a remover: ${toRemove.length}`);
  console.log('');

  // 3. Remover conexões duplicadas/revogadas
  if (toRemove.length > 0) {
    console.log('3️⃣ REMOVENDO CONEXÕES DUPLICADAS/REVOGADAS...');
    
    for (const conn of toRemove) {
      console.log(`   Removendo ${conn.id.substring(0, 8)}... (Customer: ${conn.customer_id})`);
      
      const { error: deleteError } = await supabase
        .from('google_ads_connections')
        .delete()
        .eq('id', conn.id);

      if (deleteError) {
        console.error(`   ❌ Erro ao remover: ${deleteError.message}`);
      } else {
        console.log(`   ✅ Removida com sucesso`);
      }
    }
    console.log('');
  }

  // 4. Verificar resultado final
  console.log('4️⃣ VERIFICANDO RESULTADO...');
  const { data: finalConnections, error: finalError } = await supabase
    .from('google_ads_connections')
    .select('*')
    .eq('client_id', clientId);

  if (finalError) {
    console.error('❌ Erro:', finalError);
    return;
  }

  console.log(`✅ Conexões finais: ${finalConnections.length}`);
  finalConnections.forEach((conn, index) => {
    console.log(`   ${index + 1}. Customer ID: ${conn.customer_id}, Status: ${conn.status}`);
  });
  console.log('');

  // 5. Limpar estados OAuth não utilizados
  console.log('5️⃣ LIMPANDO ESTADOS OAUTH NÃO UTILIZADOS...');
  const { data: deletedStates, error: statesError } = await supabase
    .from('oauth_states')
    .delete()
    .eq('client_id', clientId)
    .eq('used', false)
    .select();

  if (statesError) {
    console.error('❌ Erro:', statesError);
  } else {
    console.log(`✅ Removidos ${deletedStates?.length || 0} estados OAuth não utilizados`);
  }
  console.log('');

  // 6. Instruções para sincronização
  console.log('6️⃣ PRÓXIMOS PASSOS');
  console.log('-'.repeat(80));
  console.log('');
  console.log('Para sincronizar as campanhas, execute:');
  console.log('');
  console.log('   POST /api/google/sync');
  console.log('   Body: { "clientId": "e3ab33da-79f9-45e9-a43f-6ce76ceb9751", "fullSync": true }');
  console.log('');
  console.log('Ou acesse o dashboard e clique em "Sincronizar" na página do Google Ads.');
  console.log('');

  console.log('='.repeat(80));
  console.log('CORREÇÃO CONCLUÍDA');
  console.log('='.repeat(80));
}

corrigir()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
