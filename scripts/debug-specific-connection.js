/**
 * Debug Conexão Específica do Google Ads
 * Investiga a conexão específica que está falhando
 */

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugSpecificConnection() {
  console.log('🔍 DEBUG DA CONEXÃO ESPECÍFICA DO GOOGLE ADS');
  console.log('='.repeat(70));
  
  // IDs da conexão que está falhando
  const connectionId = '6d1fadb2-715b-45ea-8d1d-08c43b5a2bf3';
  const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77';
  
  console.log('\n📋 INFORMAÇÕES DA CONEXÃO:');
  console.log('- Connection ID:', connectionId);
  console.log('- Client ID:', clientId);
  
  try {
    // 1. Verificar se a conexão existe
    console.log('\n1️⃣ VERIFICANDO SE A CONEXÃO EXISTE...');
    
    const { data: connection, error: connectionError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('id', connectionId)
      .single();
    
    console.log('📊 RESULTADO DA BUSCA:');
    console.log('- Conexão encontrada:', !!connection);
    console.log('- Erro:', connectionError?.message || 'nenhum');
    console.log('- Código do erro:', connectionError?.code || 'nenhum');
    
    if (connection) {
      console.log('\n✅ CONEXÃO ENCONTRADA:');
      console.log('- ID:', connection.id);
      console.log('- Client ID:', connection.client_id);
      console.log('- Customer ID:', connection.customer_id);
      console.log('- Status:', connection.status);
      console.log('- Tem access token:', !!connection.access_token);
      console.log('- Tem refresh token:', !!connection.refresh_token);
      console.log('- Criado em:', connection.created_at);
      console.log('- Atualizado em:', connection.updated_at);
      console.log('- Dados completos:', JSON.stringify(connection, null, 2));
      
      // Verificar se o client_id bate
      if (connection.client_id !== clientId) {
        console.log('\n⚠️ PROBLEMA IDENTIFICADO:');
        console.log(`- Client ID da conexão: ${connection.client_id}`);
        console.log(`- Client ID solicitado: ${clientId}`);
        console.log('- Os IDs não batem! Isso explica o erro.');
      }
      
    } else {
      console.log('\n❌ CONEXÃO NÃO ENCONTRADA');
      
      // 2. Buscar conexões similares
      console.log('\n2️⃣ BUSCANDO CONEXÕES SIMILARES...');
      
      const { data: allConnections, error: allError } = await supabase
        .from('google_ads_connections')
        .select('*')
        .limit(10);
      
      if (allConnections && allConnections.length > 0) {
        console.log(`\n📋 ENCONTRADAS ${allConnections.length} CONEXÕES NO TOTAL:`);
        
        allConnections.forEach((conn, index) => {
          console.log(`\n${index + 1}. Conexão ${conn.id}:`);
          console.log(`   - Client ID: ${conn.client_id}`);
          console.log(`   - Customer ID: ${conn.customer_id}`);
          console.log(`   - Status: ${conn.status}`);
          console.log(`   - Criado: ${conn.created_at}`);
        });
        
        // Verificar se existe conexão com o client_id correto
        const matchingConnection = allConnections.find(conn => conn.client_id === clientId);
        
        if (matchingConnection) {
          console.log('\n✅ ENCONTRADA CONEXÃO COM CLIENT ID CORRETO:');
          console.log('- Connection ID correto:', matchingConnection.id);
          console.log('- Status:', matchingConnection.status);
          console.log('- Customer ID:', matchingConnection.customer_id);
          
          console.log('\n💡 SOLUÇÃO:');
          console.log('Use este Connection ID na URL:');
          console.log(`/api/google/accounts?connectionId=${matchingConnection.id}&clientId=${clientId}`);
        }
        
      } else {
        console.log('\n⚠️ NENHUMA CONEXÃO GOOGLE ENCONTRADA NO BANCO');
        console.log('- Isso explica por que a API retorna "Conexão não encontrada"');
        console.log('- O usuário precisa fazer uma nova conexão OAuth');
      }
    }
    
    // 3. Verificar se o client existe
    console.log('\n3️⃣ VERIFICANDO SE O CLIENT EXISTE...');
    
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
    
    if (client) {
      console.log('✅ CLIENT ENCONTRADO:');
      console.log('- ID:', client.id);
      console.log('- Nome:', client.name);
      console.log('- Organization ID:', client.organization_id);
    } else {
      console.log('❌ CLIENT NÃO ENCONTRADO');
      console.log('- Erro:', clientError?.message || 'nenhum');
    }
    
    // 4. Verificar conexões por client_id
    console.log('\n4️⃣ BUSCANDO TODAS AS CONEXÕES PARA ESTE CLIENT...');
    
    const { data: clientConnections, error: clientConnError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('client_id', clientId);
    
    if (clientConnections && clientConnections.length > 0) {
      console.log(`\n✅ ENCONTRADAS ${clientConnections.length} CONEXÕES PARA ESTE CLIENT:`);
      
      clientConnections.forEach((conn, index) => {
        console.log(`\n${index + 1}. Conexão ${conn.id}:`);
        console.log(`   - Status: ${conn.status}`);
        console.log(`   - Customer ID: ${conn.customer_id}`);
        console.log(`   - Tem tokens: ${!!conn.access_token && !!conn.refresh_token}`);
        console.log(`   - Criado: ${conn.created_at}`);
        console.log(`   - Atualizado: ${conn.updated_at}`);
      });
      
      // Encontrar a conexão mais recente e ativa
      const activeConnection = clientConnections
        .filter(conn => conn.status === 'active' && conn.access_token && conn.refresh_token)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
      
      if (activeConnection) {
        console.log('\n🎯 CONEXÃO ATIVA MAIS RECENTE:');
        console.log('- Connection ID:', activeConnection.id);
        console.log('- Status:', activeConnection.status);
        console.log('- Customer ID:', activeConnection.customer_id);
        
        console.log('\n💡 URL CORRETA PARA USAR:');
        console.log(`/api/google/accounts?connectionId=${activeConnection.id}&clientId=${clientId}`);
      }
      
    } else {
      console.log('❌ NENHUMA CONEXÃO ENCONTRADA PARA ESTE CLIENT');
    }
    
  } catch (error) {
    console.error('\n❌ ERRO NO DEBUG:', error);
    console.error('- Mensagem:', error.message);
    console.error('- Stack:', error.stack);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🏁 DEBUG CONCLUÍDO');
  
  console.log('\n📋 RESUMO:');
  console.log('1. Se a conexão não existe: usuário precisa refazer OAuth');
  console.log('2. Se existe mas com ID diferente: usar o ID correto');
  console.log('3. Se existe mas sem tokens: refazer autenticação');
  console.log('4. Se tudo estiver correto: problema pode ser de cache');
}

// Executar debug
debugSpecificConnection().catch(console.error);