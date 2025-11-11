/**
 * Debug dos Parâmetros Null no OAuth
 * Investiga por que connectionId e clientId chegam como null
 */

// Carregar variáveis de ambiente
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugParametrosNull() {
  console.log('🔍 DEBUG: PARÂMETROS NULL NO OAUTH');
  console.log('='.repeat(60));
  
  try {
    // 1. Verificar se há states OAuth pendentes
    console.log('1️⃣ VERIFICANDO STATES OAUTH PENDENTES...');
    
    const { data: oauthStates, error: statesError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('provider', 'google')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    
    if (statesError) {
      console.error('❌ Erro ao buscar states:', statesError.message);
      return;
    }
    
    console.log(`📊 States OAuth encontrados: ${oauthStates.length}`);
    
    if (oauthStates.length > 0) {
      console.log('🔍 Detalhes dos states:');
      oauthStates.forEach((state, index) => {
        console.log(`   ${index + 1}. State: ${state.state}`);
        console.log(`      Client ID: ${state.client_id}`);
        console.log(`      User ID: ${state.user_id}`);
        console.log(`      Criado em: ${state.created_at}`);
        console.log(`      Expira em: ${state.expires_at}`);
      });
    }
    
    // 2. Verificar conexões Google Ads recentes
    console.log('\n2️⃣ VERIFICANDO CONEXÕES GOOGLE ADS RECENTES...');
    
    const { data: connections, error: connectionsError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (connectionsError) {
      console.error('❌ Erro ao buscar conexões:', connectionsError.message);
      return;
    }
    
    console.log(`📊 Conexões encontradas: ${connections.length}`);
    
    if (connections.length > 0) {
      console.log('🔍 Detalhes das conexões:');
      connections.forEach((conn, index) => {
        console.log(`   ${index + 1}. ID: ${conn.id}`);
        console.log(`      Client ID: ${conn.client_id}`);
        console.log(`      User ID: ${conn.user_id}`);
        console.log(`      Customer ID: ${conn.customer_id}`);
        console.log(`      Status: ${conn.status}`);
        console.log(`      Criado em: ${conn.created_at}`);
        console.log(`      Token expira em: ${conn.token_expires_at}`);
      });
    }
    
    // 3. Simular URL de callback para testar
    console.log('\n3️⃣ SIMULANDO TESTE DE URL DE CALLBACK...');
    
    if (oauthStates.length > 0 && connections.length > 0) {
      const latestState = oauthStates[0];
      const latestConnection = connections[0];
      
      const simulatedUrl = `/google/select-accounts?connectionId=${latestConnection.id}&clientId=${latestState.client_id}&success=oauth_complete`;
      console.log('🔗 URL simulada:', simulatedUrl);
      
      // Testar se os parâmetros são válidos
      const urlParams = new URLSearchParams(simulatedUrl.split('?')[1]);
      console.log('📋 Parâmetros extraídos:');
      console.log(`   connectionId: ${urlParams.get('connectionId')}`);
      console.log(`   clientId: ${urlParams.get('clientId')}`);
      console.log(`   success: ${urlParams.get('success')}`);
      
      // Verificar se são UUIDs válidos
      const connectionId = urlParams.get('connectionId');
      const clientId = urlParams.get('clientId');
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      console.log('✅ Validação de UUIDs:');
      console.log(`   connectionId é UUID válido: ${uuidRegex.test(connectionId)}`);
      console.log(`   clientId é UUID válido: ${uuidRegex.test(clientId)}`);
    }
    
    // 4. Testar API de contas com dados reais
    console.log('\n4️⃣ TESTANDO API DE CONTAS COM DADOS REAIS...');
    
    if (connections.length > 0) {
      const testConnection = connections[0];
      const testUrl = `http://localhost:3000/api/google/accounts?connectionId=${testConnection.id}&clientId=${testConnection.client_id}`;
      
      console.log('📡 Testando URL:', testUrl);
      
      try {
        const response = await fetch(testUrl);
        console.log('📊 Status da resposta:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Resposta da API:', {
            success: data.success,
            accountsCount: data.accounts?.length || 0,
            isReal: data.isReal,
            isFallback: data.isFallback
          });
        } else {
          const error = await response.json();
          console.error('❌ Erro na API:', error);
        }
      } catch (fetchError) {
        console.error('❌ Erro ao fazer requisição:', fetchError.message);
      }
    }
    
    // 5. Diagnóstico final
    console.log('\n5️⃣ DIAGNÓSTICO FINAL');
    console.log('='.repeat(40));
    
    if (oauthStates.length === 0) {
      console.log('⚠️ PROBLEMA: Nenhum state OAuth encontrado');
      console.log('💡 SOLUÇÃO: Inicie um novo fluxo OAuth');
    }
    
    if (connections.length === 0) {
      console.log('⚠️ PROBLEMA: Nenhuma conexão Google Ads encontrada');
      console.log('💡 SOLUÇÃO: Complete o fluxo OAuth até o final');
    }
    
    if (oauthStates.length > 0 && connections.length > 0) {
      console.log('✅ DADOS: States e conexões existem no banco');
      console.log('🔍 INVESTIGAR: Por que os parâmetros chegam como null');
      console.log('💡 POSSÍVEIS CAUSAS:');
      console.log('   1. Problema no redirecionamento HTML+JS');
      console.log('   2. Parâmetros perdidos no navegador');
      console.log('   3. Problema na extração de searchParams');
      console.log('   4. Cache do navegador interferindo');
    }
    
    console.log('\n🎯 PRÓXIMOS PASSOS:');
    console.log('1. Limpe o cache do navegador (Ctrl+Shift+R)');
    console.log('2. Abra o DevTools (F12) antes de iniciar OAuth');
    console.log('3. Monitore a aba Network para ver os redirecionamentos');
    console.log('4. Verifique se a URL final tem os parâmetros corretos');
    
  } catch (error) {
    console.error('❌ ERRO GERAL:', error);
    console.error('Stack:', error.stack);
  }
}

// Executar debug
debugParametrosNull().catch(console.error);