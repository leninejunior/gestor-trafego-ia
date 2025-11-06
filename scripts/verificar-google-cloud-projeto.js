require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verificarProjeto() {
  console.log('☁️ VERIFICANDO CONFIGURAÇÃO DO GOOGLE CLOUD PROJECT\n');

  try {
    // Buscar conexão ativa
    const { data: connections } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('status', 'active')
      .limit(1);

    const connection = connections[0];
    const newAccessToken = connection.access_token;

    console.log('📋 PROBLEMA IDENTIFICADO:');
    console.log('✅ Developer Token: APROVADO');
    console.log('✅ OAuth: Funcionando');
    console.log('✅ Email: drive.engrene@gmail.com (correto)');
    console.log('❌ API: Retorna 404');
    console.log('🏢 Cenário: MCC com muitas contas');

    console.log('\n🧪 TESTE 1: Verificar se a API Google Ads está ativada');
    console.log('💡 Vamos tentar descobrir qual projeto está sendo usado');

    // Tentar acessar informações do projeto via token
    const projectResponse = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + newAccessToken);
    
    if (projectResponse.ok) {
      const tokenInfo = await projectResponse.json();
      console.log('📊 Informações do token OAuth:');
      console.log('   Audience:', tokenInfo.audience || 'N/A');
      console.log('   Issued to:', tokenInfo.issued_to || 'N/A');
      console.log('   Scope:', tokenInfo.scope || 'N/A');
      console.log('   Expires in:', tokenInfo.expires_in || 'N/A');
      
      if (tokenInfo.issued_to) {
        console.log('\n📋 Client ID do projeto:', tokenInfo.issued_to);
        console.log('💡 Este é o projeto que está sendo usado');
      }
    }

    console.log('\n🧪 TESTE 2: Tentar diferentes endpoints da API');
    
    // Testar endpoint de quota/billing para ver se a API está ativada
    const quotaResponse = await fetch('https://googleads.googleapis.com/v16/customers/1234567890/googleAds:search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${newAccessToken}`,
        'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'SELECT customer.id FROM customer LIMIT 1'
      }),
    });

    console.log(`📡 Status do endpoint de search: ${quotaResponse.status}`);
    
    if (quotaResponse.status === 403) {
      const quotaError = await quotaResponse.text();
      console.log('⚠️ Erro 403 - API pode não estar ativada:');
      console.log(quotaError.substring(0, 300));
    } else if (quotaResponse.status === 400) {
      console.log('✅ Erro 400 - API está ativada (customer ID inválido é esperado)');
    } else if (quotaResponse.status === 404) {
      console.log('❌ Erro 404 - API não está ativada ou token não tem acesso');
    }

    console.log('\n📚 INSTRUÇÕES DETALHADAS PARA RESOLVER:');
    console.log('');
    console.log('🔧 PASSO 1: Verificar Google Cloud Console');
    console.log('1. Acesse: https://console.cloud.google.com');
    console.log('2. Certifique-se de estar logado com: drive.engrene@gmail.com');
    console.log('3. No topo, verifique qual projeto está selecionado');
    console.log('4. Se não for o projeto correto, clique e selecione o projeto certo');
    console.log('');
    console.log('🔧 PASSO 2: Ativar Google Ads API');
    console.log('1. No projeto correto, vá em: APIs e Serviços → Biblioteca');
    console.log('2. Procure por: "Google Ads API"');
    console.log('3. Clique na API e verifique se está "ATIVADA"');
    console.log('4. Se não estiver, clique em "ATIVAR"');
    console.log('');
    console.log('🔧 PASSO 3: Verificar credenciais OAuth');
    console.log('1. Vá em: APIs e Serviços → Credenciais');
    console.log('2. Encontre seu OAuth 2.0 Client ID');
    console.log('3. Verifique se os URIs de redirecionamento estão corretos');
    console.log('4. Anote o Client ID e compare com o .env');
    console.log('');
    console.log('🔧 PASSO 4: Verificar Developer Token');
    console.log('1. Acesse: https://ads.google.com');
    console.log('2. Login com: drive.engrene@gmail.com');
    console.log('3. Vá em: Ferramentas → Centro de API');
    console.log('4. Verifique o status do Developer Token');
    console.log('5. Se for BASIC ACCESS, solicite STANDARD ACCESS para MCC');

    console.log('\n💡 DIAGNÓSTICO ESPECÍFICO PARA SEU CASO:');
    console.log('');
    console.log('🎯 PROBLEMA MAIS PROVÁVEL:');
    console.log('   Você tem BASIC ACCESS aprovado, mas MCC precisa de STANDARD ACCESS');
    console.log('');
    console.log('📋 TIPOS DE ACESSO:');
    console.log('   • BASIC ACCESS:');
    console.log('     - Apenas suas próprias contas Google Ads');
    console.log('     - Aprovação automática/rápida');
    console.log('     - NÃO funciona com MCC');
    console.log('');
    console.log('   • STANDARD ACCESS:');
    console.log('     - Contas de terceiros + MCC');
    console.log('     - Aprovação manual do Google');
    console.log('     - Pode levar semanas');
    console.log('     - Requer justificativa detalhada');
    console.log('');
    console.log('🚀 SOLUÇÃO RECOMENDADA:');
    console.log('   1. Solicite STANDARD ACCESS no Centro de API');
    console.log('   2. Explique que precisa gerenciar MCC com múltiplas contas');
    console.log('   3. Mencione que é para sistema de gerenciamento de campanhas');
    console.log('   4. Aguarde aprovação (pode levar 2-4 semanas)');
    console.log('');
    console.log('🔄 TESTE TEMPORÁRIO:');
    console.log('   Enquanto aguarda STANDARD ACCESS, teste com uma conta');
    console.log('   individual (fora da MCC) para validar o sistema');

    console.log('\n📞 INFORMAÇÕES PARA CONTATO COM GOOGLE:');
    console.log('   Se precisar entrar em contato com o suporte:');
    console.log('   • Email da conta: drive.engrene@gmail.com');
    console.log('   • Developer Token: ' + process.env.GOOGLE_DEVELOPER_TOKEN);
    console.log('   • Tipo de acesso necessário: STANDARD ACCESS');
    console.log('   • Motivo: Gerenciamento de MCC com múltiplas contas de clientes');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

verificarProjeto();