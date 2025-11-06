/**
 * Verificar status do Developer Token do Google Ads
 */

require('dotenv').config();

async function verificarStatusDeveloperToken() {
  console.log('🔍 Verificando status do Developer Token...\n');

  const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;
  
  console.log('📋 Developer Token:', developerToken);
  console.log('📋 Tamanho:', developerToken?.length || 0, 'caracteres');
  console.log('📋 Formato:', /^[A-Za-z0-9_-]+$/.test(developerToken) ? '✅ Válido' : '❌ Inválido');

  console.log('\n🔍 DIAGNÓSTICO DO DEVELOPER TOKEN:\n');

  // Verificar formato
  if (!developerToken) {
    console.log('❌ Developer Token não configurado');
    return;
  }

  if (developerToken.length < 20) {
    console.log('⚠️ Developer Token muito curto (pode ser inválido)');
  }

  // Verificar se é um token de teste/exemplo
  const testTokens = [
    'YOUR_DEVELOPER_TOKEN_HERE',
    'INSERT_DEVELOPER_TOKEN_HERE',
    'DEVELOPER_TOKEN',
    'TEST_TOKEN',
    'EXAMPLE_TOKEN'
  ];

  if (testTokens.includes(developerToken)) {
    console.log('❌ Usando token de exemplo/placeholder');
    return;
  }

  console.log('✅ Token parece ter formato válido');

  // Informações sobre aprovação
  console.log('\n📚 SOBRE APROVAÇÃO DO DEVELOPER TOKEN:\n');
  console.log('1. 🏢 BASIC ACCESS (Padrão):');
  console.log('   - Acesso apenas às suas próprias contas');
  console.log('   - Aprovação automática para contas com histórico');
  console.log('   - Limitado a contas que você gerencia');
  
  console.log('\n2. 🌟 STANDARD ACCESS:');
  console.log('   - Acesso a contas de terceiros');
  console.log('   - Requer aprovação manual do Google');
  console.log('   - Processo pode levar semanas');
  
  console.log('\n🔍 COMO VERIFICAR STATUS:');
  console.log('1. Acesse: https://ads.google.com');
  console.log('2. Vá em: Ferramentas → Centro de API');
  console.log('3. Verifique o status do seu Developer Token');
  
  console.log('\n📊 POSSÍVEIS STATUS:');
  console.log('✅ APPROVED - Token aprovado e funcionando');
  console.log('⏳ PENDING - Aguardando aprovação');
  console.log('❌ REJECTED - Token rejeitado');
  console.log('⚠️ SUSPENDED - Token suspenso');

  console.log('\n🧪 TESTE SIMPLES:');
  console.log('Se você consegue ver campanhas no Google Ads web,');
  console.log('mas a API retorna 404, provavelmente o token não está aprovado.');

  // Verificar se temos contas Google Ads reais
  console.log('\n❓ PERGUNTAS IMPORTANTES:');
  console.log('1. Você tem contas Google Ads ativas?');
  console.log('2. Você gastou dinheiro em anúncios?');
  console.log('3. Você solicitou o Developer Token no Google Ads?');
  console.log('4. Você recebeu email de aprovação do Google?');

  console.log('\n💡 PRÓXIMOS PASSOS:');
  console.log('1. Verifique o status no Centro de API do Google Ads');
  console.log('2. Se não aprovado, solicite aprovação');
  console.log('3. Se aprovado, verifique se tem Customer IDs válidos');
  console.log('4. Teste com uma conta real que você gerencia');
}

// Executar verificação
verificarStatusDeveloperToken();