/**
 * Teste da API real do Google Ads para buscar contas
 * Testa a implementação real da API de accounts
 */

// Carregar variáveis de ambiente
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRealGoogleAccountsAPI() {
  console.log('🔍 Testando API real do Google Ads para buscar contas...\n');

  try {
    // 1. Buscar conexão Google existente
    console.log('1. Buscando conexão Google existente...');
    
    const { data: connections, error: connectionsError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .order('created_at', { ascending: false });

    if (connectionsError) {
      console.error('❌ Erro ao buscar conexões:', connectionsError);
      return;
    }

    if (!connections || connections.length === 0) {
      console.log('❌ Nenhuma conexão Google encontrada');
      console.log('   Execute o fluxo OAuth primeiro para criar uma conexão');
      return;
    }

    const connection = connections[0];
    console.log('✅ Conexão encontrada:', connection.id);
    console.log(`   Client ID: ${connection.client_id}`);
    console.log(`   Customer ID: ${connection.customer_id}`);
    console.log(`   Status: ${connection.status}`);
    console.log(`   Has Access Token: ${!!connection.access_token}`);
    console.log(`   Has Refresh Token: ${!!connection.refresh_token}`);

    // 2. Testar API de accounts com dados reais
    console.log('\n2. Testando API de accounts com implementação real...');
    
    try {
      const response = await fetch(`http://localhost:3000/api/google/accounts?connectionId=${connection.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`Status da resposta: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API funcionou! Resposta:');
        console.log(JSON.stringify(data, null, 2));
        
        // Analisar os dados retornados
        if (data.isReal) {
          console.log('\n🎉 DADOS REAIS OBTIDOS DA API DO GOOGLE ADS!');
          console.log(`   Total de contas: ${data.totalAccounts}`);
          console.log(`   É MCC: ${data.isMCC ? 'Sim' : 'Não'}`);
          
          if (data.accounts && data.accounts.length > 0) {
            console.log('\n📋 Contas encontradas:');
            data.accounts.forEach((account, index) => {
              console.log(`   ${index + 1}. ${account.descriptiveName}`);
              console.log(`      ID: ${account.customerId}`);
              console.log(`      Moeda: ${account.currencyCode}`);
              console.log(`      Fuso: ${account.timeZone}`);
              console.log(`      MCC: ${account.canManageClients ? 'Sim' : 'Não'}`);
            });
          }
        } else {
          console.log('\n⚠️ Dados mock/fallback retornados');
          console.log('   Verifique se os tokens estão válidos');
        }
        
      } else {
        const errorText = await response.text();
        console.log('❌ Erro na API:', errorText);
      }
    } catch (apiError) {
      console.error('❌ Erro ao chamar API:', apiError.message);
    }

    // 3. Verificar variáveis de ambiente necessárias
    console.log('\n3. Verificando variáveis de ambiente...');
    
    const requiredVars = {
      'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID,
      'GOOGLE_CLIENT_SECRET': process.env.GOOGLE_CLIENT_SECRET,
      'GOOGLE_DEVELOPER_TOKEN': process.env.GOOGLE_DEVELOPER_TOKEN,
    };

    let allVarsPresent = true;
    Object.entries(requiredVars).forEach(([key, value]) => {
      if (value) {
        console.log(`✅ ${key}: Definida`);
      } else {
        console.log(`❌ ${key}: NÃO DEFINIDA`);
        allVarsPresent = false;
      }
    });

    if (!allVarsPresent) {
      console.log('\n⚠️ Algumas variáveis de ambiente estão faltando');
      console.log('   Isso pode causar falhas na API do Google Ads');
    }

    // 4. Testar chamada direta à API do Google (se tiver tokens)
    if (connection.access_token && allVarsPresent) {
      console.log('\n4. Testando chamada direta à API do Google Ads...');
      
      try {
        // Descriptografar token (simplificado para teste)
        const accessToken = connection.access_token; // Assumindo não criptografado para teste
        
        const response = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN,
            'Content-Type': 'application/json',
          },
        });

        console.log(`Status da API Google: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Chamada direta à API Google funcionou!');
          console.log('   Resposta:', JSON.stringify(data, null, 2));
        } else {
          const errorText = await response.text();
          console.log('❌ Erro na API Google:', errorText);
        }
        
      } catch (directApiError) {
        console.error('❌ Erro na chamada direta:', directApiError.message);
      }
    } else {
      console.log('\n4. Pulando teste direto (sem tokens ou variáveis)');
    }

  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

// Executar teste
testRealGoogleAccountsAPI().catch(console.error);