require('dotenv').config();

async function testarDeveloperToken() {
  console.log('🔍 Testando Developer Token do Google Ads...\n');
  
  const token = process.env.GOOGLE_DEVELOPER_TOKEN;
  
  console.log('📋 Configuração:');
  console.log(`   Developer Token: ${token?.substring(0, 10)}...`);
  console.log(`   Client ID: ${process.env.GOOGLE_CLIENT_ID?.substring(0, 20)}...`);
  console.log('');
  
  if (!token) {
    console.log('❌ GOOGLE_DEVELOPER_TOKEN não configurado!');
    return;
  }
  
  // Precisamos de um access token válido para testar
  // Vamos buscar da conexão existente
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  console.log('🔍 Buscando conexão Google Ads existente...');
  const { data: connection, error } = await supabase
    .from('google_ads_connections')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (error || !connection) {
    console.log('❌ Nenhuma conexão ativa encontrada');
    console.log('💡 Faça o OAuth primeiro para obter um access token');
    return;
  }
  
  console.log('✅ Conexão encontrada:', connection.id);
  console.log('');
  
  // Testar a API
  console.log('📡 Testando Google Ads API...');
  const url = 'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers';
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'developer-token': token,
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log('');
    
    const contentType = response.headers.get('content-type');
    console.log(`📄 Content-Type: ${contentType}`);
    console.log('');
    
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      console.log('✅ Resposta JSON recebida:');
      console.log(JSON.stringify(data, null, 2));
      
      if (response.ok) {
        console.log('\n🎉 DEVELOPER TOKEN FUNCIONANDO!');
      } else {
        console.log('\n❌ Erro na API:');
        console.log(JSON.stringify(data, null, 2));
      }
    } else {
      const text = await response.text();
      console.log('❌ Resposta HTML recebida (não JSON):');
      console.log(text.substring(0, 500));
      console.log('\n💡 Isso indica que:');
      console.log('   1. O Developer Token pode estar incorreto');
      console.log('   2. O Developer Token não está aprovado');
      console.log('   3. A conta Google Ads não está configurada corretamente');
    }
  } catch (error) {
    console.log('❌ Erro ao chamar API:', error.message);
  }
}

testarDeveloperToken().catch(console.error);
