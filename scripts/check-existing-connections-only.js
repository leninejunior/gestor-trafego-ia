/**
 * Verificar Conexões Existentes - APENAS LEITURA
 * NÃO modifica nada, apenas verifica o que existe
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('⚠️ Execute: node -r dotenv/config scripts/check-existing-connections-only.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkExistingConnections() {
  console.log('🔍 VERIFICANDO CONEXÕES EXISTENTES (APENAS LEITURA)');
  console.log('='.repeat(60));
  
  try {
    // Buscar todas as conexões Google
    const { data: connections, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Erro ao buscar conexões:', error.message);
      return;
    }
    
    console.log(`\n📊 TOTAL DE CONEXÕES ENCONTRADAS: ${connections?.length || 0}`);
    
    if (!connections || connections.length === 0) {
      console.log('\n⚠️ NENHUMA CONEXÃO GOOGLE ENCONTRADA');
      console.log('Isso explica o erro "Conexão não encontrada"');
      console.log('\n💡 SOLUÇÃO:');
      console.log('1. Acesse: https://gestor.engrene.com/dashboard/google');
      console.log('2. Clique em "Conectar Google Ads"');
      console.log('3. Complete o processo OAuth');
      return;
    }
    
    console.log('\n📋 CONEXÕES ENCONTRADAS:');
    connections.forEach((conn, index) => {
      console.log(`\n${index + 1}. Conexão ${conn.id}:`);
      console.log(`   - Client ID: ${conn.client_id}`);
      console.log(`   - Customer ID: ${conn.customer_id}`);
      console.log(`   - Status: ${conn.status}`);
      console.log(`   - Tem tokens: ${!!conn.access_token && !!conn.refresh_token}`);
      console.log(`   - Criado: ${conn.created_at}`);
      console.log(`   - Atualizado: ${conn.updated_at}`);
    });
    
    // Verificar a conexão específica que está falhando
    const failingConnectionId = '6d1fadb2-715b-45ea-8d1d-08c43b5a2bf3';
    const failingClientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77';
    
    console.log('\n🔍 VERIFICANDO CONEXÃO ESPECÍFICA QUE ESTÁ FALHANDO:');
    console.log(`- Connection ID: ${failingConnectionId}`);
    console.log(`- Client ID: ${failingClientId}`);
    
    const specificConnection = connections.find(conn => conn.id === failingConnectionId);
    
    if (specificConnection) {
      console.log('\n✅ CONEXÃO ESPECÍFICA ENCONTRADA:');
      console.log(`- Status: ${specificConnection.status}`);
      console.log(`- Client ID bate: ${specificConnection.client_id === failingClientId}`);
      console.log(`- Customer ID: ${specificConnection.customer_id}`);
      console.log(`- Tem tokens: ${!!specificConnection.access_token && !!specificConnection.refresh_token}`);
      
      if (specificConnection.client_id !== failingClientId) {
        console.log('\n⚠️ PROBLEMA IDENTIFICADO:');
        console.log('O Client ID da conexão não bate com o solicitado');
        console.log(`Conexão tem: ${specificConnection.client_id}`);
        console.log(`Solicitado: ${failingClientId}`);
      }
    } else {
      console.log('\n❌ CONEXÃO ESPECÍFICA NÃO ENCONTRADA');
      
      // Buscar conexões para o client_id
      const clientConnections = connections.filter(conn => conn.client_id === failingClientId);
      
      if (clientConnections.length > 0) {
        console.log(`\n✅ ENCONTRADAS ${clientConnections.length} CONEXÕES PARA ESTE CLIENT:`);
        clientConnections.forEach((conn, index) => {
          console.log(`${index + 1}. Connection ID: ${conn.id}`);
          console.log(`   Status: ${conn.status}`);
          console.log(`   Customer ID: ${conn.customer_id}`);
        });
        
        const activeConnection = clientConnections.find(conn => 
          conn.status === 'active' && conn.access_token && conn.refresh_token
        );
        
        if (activeConnection) {
          console.log('\n💡 CONEXÃO ATIVA ENCONTRADA:');
          console.log(`Use este Connection ID: ${activeConnection.id}`);
          console.log(`URL correta: /api/google/accounts?connectionId=${activeConnection.id}&clientId=${failingClientId}`);
        }
      } else {
        console.log('\n❌ NENHUMA CONEXÃO ENCONTRADA PARA ESTE CLIENT');
      }
    }
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ VERIFICAÇÃO CONCLUÍDA - NADA FOI MODIFICADO');
}

checkExistingConnections().catch(console.error);