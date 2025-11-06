require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function refreshETestar() {
  console.log('🔄 REFRESH TOKEN E TESTE COMPLETO\n');

  try {
    // Buscar conexão ativa
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('status', 'active')
      .limit(1);

    if (connError || !connections || connections.length === 0) {
      console.error('❌ Nenhuma conexão ativa encontrada:', connError);
      return;
    }

    const connection = connections[0];
    console.log('✅ Conexão encontrada:', connection.id);

    if (!connection.refresh_token) {
      console.error('❌ Refresh token não encontrado');
      return;
    }

    console.log('🔄 Fazendo refresh do token...');
    
    // Fazer refresh do token
    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!refreshResponse.ok) {
      const refreshError = await refreshResponse.text();
      console.error('❌ Erro ao fazer refresh:', refreshError);
      return;
    }

    const refreshData = await refreshResponse.json();
    console.log('✅ Token refreshed com sucesso');

    // Atualizar token no banco
    const { error: updateError } = await supabase
      .from('google_ads_connections')
      .update({
        access_token: refreshData.access_token,
        token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
      })
      .eq('id', connection.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar token:', updateError);
      return;
    }

    console.log('💾 Token atualizado no banco');
    
    // Agora testar a API
    const newAccessToken = refreshData.access_token;
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;

    console.log('\n🧪 TESTANDO API COM TOKEN NOVO...');
    console.log('📋 Developer Token:', developerToken);
    console.log('📋 Access Token:', newAccessToken.substring(0, 20) + '...');

    // Verificar token OAuth
    console.log('\n1️⃣ Verificando token OAuth...');
    const tokenResponse = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + newAccessToken);
    
    if (tokenResponse.ok) {
      const tokenInfo = await tokenResponse.json();
      console.log('✅ Token OAuth válido');
      console.log(`   Expira em: ${tokenInfo.expires_in} segundos`);
      console.log(`   Escopo: ${tokenInfo.scope}`);
      
      if (tokenInfo.scope && tokenInfo.scope.includes('adwords')) {
        console.log('✅ Escopo Google Ads presente');
      } else {
        console.log('❌ Escopo Google Ads ausente');
        return;
      }
    } else {
      console.log('❌ Token OAuth ainda inválido');
      return;
    }

    // Testar API listAccessibleCustomers
    console.log('\n2️⃣ Testando listAccessibleCustomers...');
    const listResponse = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${newAccessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      },
    });

    console.log(`📡 Status: ${listResponse.status}`);
    console.log(`📡 Headers:`, Object.fromEntries(listResponse.headers.entries()));
    
    if (listResponse.ok) {
      const data = await listResponse.json();
      console.log('✅ API FUNCIONANDO!');
      console.log('📊 Resposta:', JSON.stringify(data, null, 2));
      
      if (data.resourceNames && data.resourceNames.length > 0) {
        console.log(`\n🎉 ${data.resourceNames.length} conta(s) encontrada(s):`);
        data.resourceNames.forEach((resourceName, index) => {
          const customerId = resourceName.replace('customers/', '');
          console.log(`   ${index + 1}. Customer ID: ${customerId}`);
        });
      } else {
        console.log('\n⚠️ API funcionou mas nenhuma conta encontrada');
        console.log('💡 Isso significa que o Developer Token está aprovado,');
        console.log('   mas você não tem contas Google Ads acessíveis');
      }
    } else {
      const errorText = await listResponse.text();
      console.log('❌ API não funcionando');
      console.log('📄 Erro completo:', errorText);
      
      if (listResponse.status === 404) {
        console.log('\n💡 DIAGNÓSTICO FINAL:');
        console.log('   - Token OAuth: ✅ Válido');
        console.log('   - Escopo: ✅ Correto');
        console.log('   - Developer Token: ❌ Não aprovado pelo Google');
        console.log('\n📚 SOLUÇÃO:');
        console.log('   1. Acesse https://ads.google.com');
        console.log('   2. Vá em Ferramentas → Centro de API');
        console.log('   3. Solicite aprovação do Developer Token');
        console.log('   4. Aguarde email de confirmação');
      } else if (listResponse.status === 401) {
        console.log('\n💡 DIAGNÓSTICO: Problema de autenticação');
      } else {
        console.log('\n💡 DIAGNÓSTICO: Erro desconhecido');
      }
    }

    console.log('\n📋 RESUMO FINAL:');
    console.log('🔄 Token refreshed: ✅');
    console.log('🔗 OAuth válido: ✅');
    console.log('🎯 Escopo correto: ✅');
    console.log('🔑 Developer Token: ❓ (testado acima)');
    
    console.log('\n💡 PRÓXIMOS PASSOS:');
    console.log('1. Se API retornou 404: Solicitar aprovação do Developer Token');
    console.log('2. Se API funcionou mas sem contas: Criar conta Google Ads');
    console.log('3. Se API funcionou com contas: Sistema pronto! 🎉');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

refreshETestar();