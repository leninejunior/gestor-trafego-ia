/**
 * Teste final do callback forçado
 */

const baseUrl = 'https://gestor.engrene.com';

async function testCallbackFinal() {
  console.log('🚨 TESTE FINAL DO CALLBACK FORÇADO');
  console.log('='.repeat(60));
  
  const tests = [
    { 
      url: '/api/google/callback', 
      desc: 'Callback original (sem parâmetros)',
      expected: 'HTML com redirecionamento JS'
    },
    { 
      url: '/api/google/callback?error=access_denied', 
      desc: 'Callback com erro OAuth',
      expected: 'HTML redirecionando para erro'
    },
    { 
      url: '/api/google/callback?code=test123&state=abc456', 
      desc: 'Callback com sucesso simulado',
      expected: 'HTML redirecionando para seleção'
    }
  ];
  
  for (const test of tests) {
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
        
        if (text.includes('window.location.href')) {
          console.log('✅ HTML com redirecionamento JavaScript detectado');
          
          // Extrair URL de redirecionamento
          const match = text.match(/window\.location\.href = '([^']+)'/);
          if (match) {
            console.log(`🎯 Redireciona para: ${match[1]}`);
            
            if (match[1].includes('/google/select-accounts')) {
              console.log('✅ Redirecionamento correto para seleção de contas');
            } else {
              console.log('⚠️ Redirecionamento para local inesperado');
            }
          }
          
          if (text.includes('Processando OAuth')) {
            console.log('✅ Interface de loading presente');
          }
          
        } else {
          console.log('❌ HTML sem redirecionamento JavaScript');
        }
      } else {
        console.log('❌ Resposta não é HTML válido');
      }
      
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 RESULTADO ESPERADO:');
  console.log('Se todos os testes mostrarem "HTML com redirecionamento JavaScript",');
  console.log('então o callback está funcionando e o problema foi resolvido!');
  
  console.log('\n💡 PRÓXIMO PASSO:');
  console.log('Teste o fluxo completo no navegador:');
  console.log('1. Acesse https://gestor.engrene.com/dashboard/google');
  console.log('2. Clique em "Conectar Google Ads"');
  console.log('3. Complete o OAuth do Google');
  console.log('4. Deveria chegar na página de seleção de contas!');
}

testCallbackFinal().catch(console.error);