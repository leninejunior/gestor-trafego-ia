/**
 * Teste completo do callback no localhost
 * Simula o fluxo OAuth completo localmente
 */

const baseUrl = 'http://localhost:3000';

async function testLocalhostCallbackComplete() {
  console.log('🏠 TESTE COMPLETO DO CALLBACK NO LOCALHOST');
  console.log('='.repeat(60));
  
  // Verificar se servidor está rodando
  try {
    console.log('\n🔍 1. VERIFICANDO SE SERVIDOR ESTÁ RODANDO...');
    const healthCheck = await fetch(`${baseUrl}/api/test-simple`);
    
    if (!healthCheck.ok) {
      console.log('❌ Servidor não está rodando!');
      console.log('Execute: pnpm dev');
      return;
    }
    
    console.log('✅ Servidor rodando no localhost:3000');
    
  } catch (error) {
    console.log('❌ Servidor não está rodando!');
    console.log('Execute: pnpm dev');
    return;
  }
  
  // Testar callbacks
  console.log('\n🔍 2. TESTANDO CALLBACKS...');
  
  const callbackTests = [
    {
      url: '/api/google/callback',
      desc: 'Callback principal (sem parâmetros)',
      expected: 'HTML com redirecionamento'
    },
    {
      url: '/api/google/callback?error=access_denied',
      desc: 'Callback com erro OAuth',
      expected: 'HTML redirecionando para erro'
    },
    {
      url: '/api/google/callback?code=test_code_123&state=test_state_456',
      desc: 'Callback com sucesso simulado',
      expected: 'HTML redirecionando para seleção'
    },
    {
      url: '/api/oauth/google-callback?code=test&state=test',
      desc: 'Callback alternativo',
      expected: 'HTML com redirecionamento'
    },
    {
      url: '/google/callback?code=test&state=test',
      desc: 'Callback como página',
      expected: 'Página Next.js com redirecionamento'
    }
  ];
  
  for (const test of callbackTests) {
    try {
      console.log(`\n🧪 ${test.desc}`);
      console.log(`URL: ${baseUrl}${test.url}`);
      console.log(`Esperado: ${test.expected}`);
      
      const response = await fetch(`${baseUrl}${test.url}`);
      console.log(`Status: ${response.status}`);
      
      const contentType = response.headers.get('content-type');
      console.log(`Content-Type: ${contentType}`);
      
      if (response.ok && contentType?.includes('text/html')) {
        const text = await response.text();
        
        // Verificar se é callback forçado (HTML + JS)
        if (text.includes('window.location.href')) {
          console.log('✅ CALLBACK FORÇADO FUNCIONANDO!');
          
          // Extrair URL de redirecionamento
          const match = text.match(/window\\.location\\.href = '([^']+)'/);
          if (match) {
            console.log(`🎯 Redireciona para: ${match[1]}`);
            
            if (match[1].includes('/google/select-accounts')) {
              console.log('✅ Redirecionamento correto para seleção de contas');
            }
          }
          
        } else if (text.includes('Processando OAuth') || text.includes('Processando autenticação')) {
          console.log('✅ Interface de callback detectada');
          
        } else if (text.includes('useRouter') || text.includes('Next.js')) {
          console.log('✅ Página Next.js (callback como página)');
          
        } else {
          console.log('⚠️ HTML inesperado');
          console.log('Primeiros 200 chars:', text.substring(0, 200));
        }
        
      } else {
        console.log('❌ Resposta não é HTML válido');
      }
      
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
  }
  
  // Testar página de seleção de contas
  console.log('\n🔍 3. TESTANDO PÁGINA DE SELEÇÃO DE CONTAS...');
  
  try {
    const selectUrl = `${baseUrl}/google/select-accounts?test=true`;
    console.log(`URL: ${selectUrl}`);
    
    const selectResponse = await fetch(selectUrl);
    console.log(`Status: ${selectResponse.status}`);
    
    if (selectResponse.ok) {
      const selectText = await selectResponse.text();
      
      if (selectText.includes('Selecionar Contas') || selectText.includes('Google Ads')) {
        console.log('✅ Página de seleção de contas funcionando');
      } else if (selectText.includes('Processo OAuth Incompleto')) {
        console.log('⚠️ Página mostra "Processo OAuth Incompleto" (normal sem dados)');
      } else {
        console.log('⚠️ Página carregada mas conteúdo inesperado');
      }
    } else {
      console.log('❌ Página de seleção não carrega');
    }
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 RESUMO DO TESTE:');
  console.log('');
  console.log('✅ Se viu "CALLBACK FORÇADO FUNCIONANDO!", a solução está correta');
  console.log('✅ Se viu redirecionamento para "/google/select-accounts", está perfeito');
  console.log('');
  console.log('🚀 PRÓXIMO PASSO:');
  console.log('Se funcionou no localhost, deveria funcionar na produção também.');
  console.log('Aguarde alguns minutos para o deploy e teste na produção.');
  
  console.log('\n💡 PARA TESTAR FLUXO COMPLETO NO LOCALHOST:');
  console.log('1. Configure Google Cloud Console com callback localhost');
  console.log('2. Adicione http://localhost:3000/api/google/callback nas Redirect URIs');
  console.log('3. Teste o fluxo OAuth completo no navegador');
}

testLocalhostCallbackComplete().catch(console.error);