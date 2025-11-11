/**
 * Testar Google Ads API com tokens reais
 * Verifica se conseguimos acessar contas reais do Google Ads
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testarGoogleAdsAPI() {
  console.log('🔍 TESTANDO GOOGLE ADS API COM TOKENS REAIS');
  console.log('='.repeat(60));
  
  try {
    // 1. Buscar a conexão mais recente
    console.log('\n1️⃣ BUSCANDO CONEXÃO MAIS RECENTE...');
    
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (connError || !connections || connections.length === 0) {
      console.error('❌ Nenhuma conexão encontrada');
      console.log('\n💡 Faça o OAuth primeiro para criar uma conexão');
      return;
    }
    
    const connection = connections[0];
    console.log('✅ Conexão encontrada:', {
      id: connection.id,
      clientId: connection.client_id,
      hasAccessToken: !!connection.access_token,
      hasRefreshToken: !!connection.refresh_token,
      tokenExpires: connection.token_expires_at
    });
    
    // 2. Testar chamada à API do Google Ads
    console.log('\n2️⃣ TESTANDO CHAMADA À API DO GOOGLE ADS...');
    
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    
    console.log('📋 Configuração:');
    console.log('   Developer Token:', developerToken ? `${developerToken.substring(0, 10)}...` : '❌ NÃO CONFIGURADO');
    console.log('   Client ID:', clientId ? `${clientId.substring(0, 20)}...` : '❌ NÃO CONFIGURADO');
    console.log('   Access Token:', connection.access_token ? `${connection.access_token.substring(0, 20)}...` : '❌ NÃO ENCONTRADO');
    
    if (!developerToken) {
      console.error('\n❌ GOOGLE_DEVELOPER_TOKEN não está configurado no .env');
      return;
    }
    
    // 3. Fazer requisição à API do Google Ads
    console.log('\n3️⃣ FAZENDO REQUISIÇÃO À API...');
    
    const url = 'https://googleads.googleapis.com/v16/customers:listAccessibleCustomers';
    
    console.log('📡 URL:', url);
    console.log('🔑 Headers:');
    console.log('   Authorization: Bearer [token]');
    console.log('   developer-token: [token]');
    console.log('   login-customer-id: (não usado nesta chamada)');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n📊 RESPOSTA DA API:');
    console.log('   Status:', response.status, response.statusText);
    
    const responseText = await response.text();
    
    if (response.ok) {
      console.log('✅ SUCESSO!');
      
      try {
        const data = JSON.parse(responseText);
        console.log('\n📋 DADOS RETORNADOS:');
        console.log(JSON.stringify(data, null, 2));
        
        if (data.resourceNames && data.resourceNames.length > 0) {
          console.log(`\n🎉 ${data.resourceNames.length} conta(s) acessível(is) encontrada(s)!`);
          data.resourceNames.forEach((name, i) => {
            const customerId = name.replace('customers/', '');
            console.log(`   ${i + 1}. Customer ID: ${customerId}`);
          });
        } else {
          console.log('\n⚠️ Nenhuma conta acessível encontrada');
          console.log('💡 Isso significa que a conta Google não tem contas Google Ads vinculadas');
        }
      } catch (parseError) {
        console.log('📄 Resposta (texto):', responseText);
      }
    } else {
      console.log('❌ ERRO NA API');
      console.log('📄 Resposta:', responseText);
      
      try {
        const errorData = JSON.parse(responseText);
        console.log('\n🔍 DETALHES DO ERRO:');
        console.log(JSON.stringify(errorData, null, 2));
        
        if (errorData.error) {
          console.log('\n💡 DIAGNÓSTICO:');
          
          if (errorData.error.code === 401) {
            console.log('   - Token de acesso inválido ou expirado');
            console.log('   - Tente fazer o OAuth novamente');
          } else if (errorData.error.code === 403) {
            console.log('   - Developer Token pode não estar aprovado');
            console.log('   - Ou a conta não tem permissão para acessar a API');
          } else if (errorData.error.code === 400) {
            console.log('   - Requisição malformada');
            console.log('   - Verifique os headers e parâmetros');
          }
        }
      } catch (e) {
        // Resposta não é JSON
      }
    }
    
    // 4. Verificar status do Developer Token
    console.log('\n4️⃣ VERIFICANDO DEVELOPER TOKEN...');
    console.log('📋 Para verificar o status do seu Developer Token:');
    console.log('   1. Acesse: https://ads.google.com/aw/apicenter');
    console.log('   2. Verifique o status do token');
    console.log('   3. Status deve ser "Approved" para produção');
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error('Stack:', error.stack);
  }
}

testarGoogleAdsAPI().catch(console.error);
