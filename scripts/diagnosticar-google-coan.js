/**
 * Script de Diagnóstico - Conexões Google Ads do Cliente COAN
 * 
 * Investiga por que as informações aparecem inconsistentes em diferentes páginas
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnosticar() {
  console.log('='.repeat(80));
  console.log('DIAGNÓSTICO: Conexões Google Ads - Cliente COAN');
  console.log('='.repeat(80));
  console.log('');

  const clientId = 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751';

  // 1. Buscar informações do cliente
  console.log('1️⃣ INFORMAÇÕES DO CLIENTE');
  console.log('-'.repeat(80));
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientError) {
    console.error('❌ Erro ao buscar cliente:', clientError);
    return;
  }

  console.log('✅ Cliente encontrado:');
  console.log(`   - ID: ${client.id}`);
  console.log(`   - Nome: ${client.name}`);
  console.log(`   - Org ID: ${client.org_id}`);
  console.log('');

  // 2. Buscar TODAS as conexões Google
  console.log('2️⃣ CONEXÕES GOOGLE ADS');
  console.log('-'.repeat(80));
  const { data: connections, error: connectionsError } = await supabase
    .from('google_ads_connections')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (connectionsError) {
    console.error('❌ Erro ao buscar conexões:', connectionsError);
    return;
  }

  console.log(`✅ Total de conexões encontradas: ${connections?.length || 0}`);
  console.log('');

  if (connections && connections.length > 0) {
    connections.forEach((conn, index) => {
      console.log(`   Conexão ${index + 1}:`);
      console.log(`   - ID: ${conn.id}`);
      console.log(`   - Customer ID: ${conn.customer_id}`);
      console.log(`   - Status: ${conn.status}`);
      console.log(`   - Refresh Token: ${conn.refresh_token ? 'SIM' : 'NÃO'}`);
      console.log(`   - Criado em: ${conn.created_at}`);
      console.log(`   - Atualizado em: ${conn.updated_at}`);
      console.log('');
    });
  }

  // 3. Verificar duplicatas
  console.log('3️⃣ ANÁLISE DE DUPLICATAS');
  console.log('-'.repeat(80));
  
  const customerIds = connections?.map(c => c.customer_id) || [];
  const uniqueCustomerIds = [...new Set(customerIds)];
  
  console.log(`   - Customer IDs únicos: ${uniqueCustomerIds.length}`);
  console.log(`   - Total de conexões: ${connections?.length || 0}`);
  
  if (uniqueCustomerIds.length < (connections?.length || 0)) {
    console.log('   ⚠️ DUPLICATAS DETECTADAS!');
    console.log('');
    
    uniqueCustomerIds.forEach(customerId => {
      const dupes = connections.filter(c => c.customer_id === customerId);
      if (dupes.length > 1) {
        console.log(`   Customer ID: ${customerId}`);
        console.log(`   - Aparece ${dupes.length} vezes`);
        dupes.forEach((d, i) => {
          console.log(`     ${i + 1}. ID: ${d.id}, Status: ${d.status}, Criado: ${d.created_at}`);
        });
        console.log('');
      }
    });
  } else {
    console.log('   ✅ Nenhuma duplicata detectada');
  }
  console.log('');

  // 4. Buscar campanhas
  console.log('4️⃣ CAMPANHAS GOOGLE ADS');
  console.log('-'.repeat(80));
  const { data: campaigns, error: campaignsError } = await supabase
    .from('google_ads_campaigns')
    .select('*')
    .eq('client_id', clientId);

  if (campaignsError) {
    console.error('❌ Erro ao buscar campanhas:', campaignsError);
  } else {
    console.log(`✅ Total de campanhas: ${campaigns?.length || 0}`);
    
    if (campaigns && campaigns.length > 0) {
      // Agrupar por connection_id
      const byConnection = {};
      campaigns.forEach(camp => {
        if (!byConnection[camp.connection_id]) {
          byConnection[camp.connection_id] = [];
        }
        byConnection[camp.connection_id].push(camp);
      });

      console.log('');
      console.log('   Campanhas por conexão:');
      Object.entries(byConnection).forEach(([connId, camps]) => {
        const conn = connections?.find(c => c.id === connId);
        console.log(`   - Conexão ${connId.substring(0, 8)}... (Customer: ${conn?.customer_id || 'N/A'}): ${camps.length} campanhas`);
      });
    }
  }
  console.log('');

  // 5. Verificar estados OAuth
  console.log('5️⃣ ESTADOS OAUTH PENDENTES');
  console.log('-'.repeat(80));
  const { data: oauthStates, error: oauthError } = await supabase
    .from('oauth_states')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (oauthError) {
    console.error('❌ Erro ao buscar estados OAuth:', oauthError);
  } else {
    console.log(`✅ Estados OAuth recentes: ${oauthStates?.length || 0}`);
    
    if (oauthStates && oauthStates.length > 0) {
      oauthStates.forEach((state, index) => {
        console.log(`   ${index + 1}. State: ${state.state}`);
        console.log(`      - Provider: ${state.provider}`);
        console.log(`      - Usado: ${state.used ? 'SIM' : 'NÃO'}`);
        console.log(`      - Criado: ${state.created_at}`);
        console.log('');
      });
    }
  }

  // 6. Recomendações
  console.log('6️⃣ RECOMENDAÇÕES');
  console.log('-'.repeat(80));
  
  if (connections && connections.length > uniqueCustomerIds.length) {
    console.log('   ⚠️ PROBLEMA IDENTIFICADO: Conexões duplicadas');
    console.log('');
    console.log('   Ações recomendadas:');
    console.log('   1. Manter apenas a conexão mais recente de cada Customer ID');
    console.log('   2. Remover conexões antigas/duplicadas');
    console.log('   3. Verificar se há campanhas associadas às conexões antigas');
    console.log('');
  }

  if (connections && connections.length === 0) {
    console.log('   ⚠️ PROBLEMA: Nenhuma conexão encontrada');
    console.log('   - O cliente precisa conectar uma conta Google Ads');
  }

  if (connections && connections.length > 0 && (!campaigns || campaigns.length === 0)) {
    console.log('   ⚠️ PROBLEMA: Conexões existem mas sem campanhas');
    console.log('   - Pode ser necessário sincronizar as campanhas');
    console.log('   - Verificar se os tokens de acesso estão válidos');
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('DIAGNÓSTICO CONCLUÍDO');
  console.log('='.repeat(80));
}

diagnosticar()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
