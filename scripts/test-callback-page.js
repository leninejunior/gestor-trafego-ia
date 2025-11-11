/**
 * Testar callback como página
 */

const baseUrl = 'https://gestor.engrene.com';

async function testCallbackPage() {
  console.log('📄 TESTANDO CALLBACK COMO PÁGINA');
  console.log('='.repeat(50));
  
  const tests = [
    { url: '/google/callback', desc: 'Callback página (sem parâmetros)' },
    { url: '/google/callback?error=access_denied', desc: 'Callback página (com erro)' },
    { url: '/google/callback?code=test&state=test', desc: 'Callback página (com sucesso)' }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n📄 ${test.desc}`);
      console.log(`URL: ${baseUrl}${test.url}`);
      
      const response = await fetch(`${baseUrl}${test.url}`);
      console.log(`Status: ${response.status}`);
      
      const contentType = response.headers.get('content-type');
      console.log(`Content-Type: ${contentType}`);
      
      if (response.ok && contentType?.includes('text/html')) {
        console.log('✅ Página HTML carregada (Next.js page)');
        
        const text = await response.text();
        
        if (text.includes('Processando OAuth')) {
          console.log('🎯 Página de callback funcionando');
        } else if (text.includes('404')) {
          console.log('❌ Página não encontrada');
        } else {
          console.log('⚠️ Página carregada mas conteúdo inesperado');
        }
      } else {
        console.log('❌ Erro ao carregar página');
      }
      
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('💡 SOLUÇÃO:');
  console.log('Se a página funcionar, vamos configurar o Google Cloud Console');
  console.log('para usar /google/callback em vez de /api/google/callback');
}

testCallbackPage().catch(console.error);