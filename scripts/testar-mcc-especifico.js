require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testarMCC() {
  console.log('🏢 TESTANDO CENÁRIO MCC (My Client Center)\n');

  console.log('📋 SITUAÇÃO CONFIRMADA:');
  console.log('✅ App criado em: drive.engrene@gmail.com');
  console.log('✅ Login OAuth: drive.engrene@gmail.com (mesmo email)');
  console.log('✅ Developer Token: APROVADO (email recebido)');
  console.log('✅ Contas: Muitas na MCC + contas fora da MCC');
  console.log('❌ Problema: API retorna 404');

  try {
    // Buscar conexão ativa
    const { data: connections } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('status', 'active')
      .limit(1);

    const connection = connections[0];
    const newAccessToken = connection.access_token;
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;

    console.log('\n🧪 TESTE 1: API com login-customer-id (MCC)');
    console.log('💡 Para MCC, às vezes é necessário especificar login-customer-id');
    
    // Testar com diferentes Customer IDs de MCC
    const possibleMCCIds = [
      '1234567890', // ID genérico de teste
      '9876543210', // Outro ID genérico
      // Você pode adicionar IDs reais da sua MCC aqui se souber
    ];

    for (const mccId of possibleMCCIds) {
      console.log(`\n🔍 Testando com MCC ID: ${mccId}`);
      
      const response = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${newAccessToken}`,
          'developer-token': developerToken,
          'login-customer-id': mccId,
          'Content-Type': 'application/json',
        },
      });

      console.log(`📡 Status com MCC ${mccId}: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`🎉 SUCESSO com MCC ${mccId}!`);
        console.log('📊 Resposta:', JSON.stringify(data, null, 2));
        break;
      } else if (response.status !== 404) {
        const errorText = await response.text();
        console.log(`⚠️ Erro diferente com MCC ${mccId}:`, errorText.substring(0, 200));
      }
    }

    console.log('\n🧪 TESTE 2: Verificar se o problema é de permissões MCC');
    console.log('📚 POSSÍVEIS CAUSAS ESPECÍFICAS DE MCC:');
    console.log('1. Developer Token aprovado mas não para MCC');
    console.log('2. Precisa de permissões especiais para MCC');
    console.log('3. MCC precisa de configuração adicional');
    console.log('4. Token aprovado apenas para contas individuais');

    console.log('\n🧪 TESTE 3: Testar sem MCC (contas individuais)');
    console.log('💡 Vamos testar se funciona com contas fora da MCC');
    
    // Testar API normal (sem login-customer-id)
    const normalResponse = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${newAccessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      },
    });

    console.log(`📡 Status sem MCC: ${normalResponse.status}`);
    
    if (normalResponse.ok) {
      const normalData = await normalResponse.json();
      console.log('🎉 FUNCIONA sem MCC!');
      console.log('📊 Contas individuais encontradas:', normalData);
    } else {
      console.log('❌ Também não funciona sem MCC');
    }

    console.log('\n🧪 TESTE 4: Verificar configuração do projeto Google Cloud');
    console.log('📚 VERIFICAÇÕES ESPECÍFICAS PARA MCC:');
    console.log('1. No Google Cloud Console:');
    console.log('   - Vá em APIs e Serviços → Biblioteca');
    console.log('   - Procure "Google Ads API"');
    console.log('   - Verifique se está ATIVADA');
    console.log('');
    console.log('2. No Google Ads (ads.google.com):');
    console.log('   - Acesse com drive.engrene@gmail.com');
    console.log('   - Vá em Ferramentas → Centro de API');
    console.log('   - Verifique o Developer Token');
    console.log('   - Veja se tem acesso à MCC');
    console.log('');
    console.log('3. Permissões MCC:');
    console.log('   - MCC pode precisar de aprovação STANDARD ACCESS');
    console.log('   - BASIC ACCESS pode não funcionar com MCC');
    console.log('   - Verifique se o token tem permissões para gerenciar outras contas');

    console.log('\n🧪 TESTE 5: Diagnóstico específico do erro');
    
    // Fazer uma chamada detalhada para ver o erro exato
    const detailedResponse = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${newAccessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Headers da resposta detalhada:');
    console.log(Object.fromEntries(detailedResponse.headers.entries()));

    if (!detailedResponse.ok) {
      const errorText = await detailedResponse.text();
      console.log('📄 Erro completo:', errorText);
      
      // Analisar o tipo de erro
      if (errorText.includes('404')) {
        console.log('\n💡 DIAGNÓSTICO: Erro 404 específico');
        console.log('🔍 POSSÍVEIS CAUSAS:');
        console.log('1. Developer Token aprovado mas não para este projeto');
        console.log('2. Token aprovado mas sem acesso a MCC');
        console.log('3. Projeto Google Cloud não vinculado corretamente');
        console.log('4. API Google Ads não ativada no projeto correto');
      }
    }

    console.log('\n📋 DIAGNÓSTICO FINAL PARA MCC:');
    console.log('');
    console.log('🔍 CENÁRIO MAIS PROVÁVEL:');
    console.log('   Seu Developer Token foi aprovado para BASIC ACCESS,');
    console.log('   mas MCC (My Client Center) requer STANDARD ACCESS.');
    console.log('');
    console.log('💡 DIFERENÇA ENTRE ACESSOS:');
    console.log('   • BASIC ACCESS: Apenas suas próprias contas');
    console.log('   • STANDARD ACCESS: Contas de terceiros + MCC');
    console.log('');
    console.log('🚀 SOLUÇÃO PARA MCC:');
    console.log('   1. Acesse https://ads.google.com');
    console.log('   2. Vá em Ferramentas → Centro de API');
    console.log('   3. Solicite STANDARD ACCESS para o Developer Token');
    console.log('   4. Explique que precisa acessar MCC');
    console.log('   5. Aguarde aprovação (pode levar semanas)');
    console.log('');
    console.log('🔄 ALTERNATIVA TEMPORÁRIA:');
    console.log('   Teste com contas individuais (fora da MCC)');
    console.log('   para verificar se o sistema funciona');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testarMCC();