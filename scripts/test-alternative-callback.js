/**
 * Testar callback alternativo
 */

const baseUrl = 'https://gestor.engrene.com';

async function testAlternativeCallback() {
  console.log('🔄 TESTANDO CALLBACK ALTERNATIVO');
  console.log('='.repeat(50));
  
  const tests = [
    { 
      url: '/api/oauth/google-callback', 
      desc: 'Callback alternativo (sem parâmetros)'
    },
    { 
      url: '/api/oauth/google-callback?error=access_denied', 
      desc: 'Callback alternativo (com erro)'
    },
    { 
      url: '/api/oauth/google-callback?code=test&state=test', 
      desc: 'Callback alternativo (com sucesso)'
    }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n🧪 ${test.desc}`);
      console.log(`URL: ${baseUrl}${test.url}`);
      
      const response = await fetch(`${baseUrl}${test.url}`);
      console.log(`Status: ${response.status}`);
      
      const contentType = response.headers.get('content-type');
      console.log(`Content-Type: ${contentType}`);
      
      if (response.ok && contentType?.includes('text/html')) {
        const text = await response.text();
        
        if (text.includes('window.location.href')) {
          console.log('✅ HTML com redirecionamento JavaScript');
          
          // Extrair URL de redirecionamento
          const match = text.match(/window\\.location\\.href = '([^']+)'/);
          if (match) {
            console.log(`🎯 Redireciona para: ${match[1]}`);
          }
          
        } else if (text.includes('Processando autenticação')) {
          console.log('✅ Interface de callback detectada');
        } else {
          console.log('❌ HTML inesperado');
          console.log('Primeiros 200 chars:', text.substring(0, 200));
        }
      } else {
        console.log('❌ Resposta não é HTML válido');
      }
      
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('💡 SE FUNCIONAR:');
  console.log('Configure o Google Cloud Console para usar:');
  console.log('https://gestor.engrene.com/api/oauth/google-callback');
  console.log('em vez de /api/google/callback');
}

testAlternativeCallback().catch(console.error);