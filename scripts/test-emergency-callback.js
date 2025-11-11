/**
 * Testar callback de emergência
 */

const baseUrl = 'https://gestor.engrene.com';

async function testEmergencyCallback() {
  console.log('🚨 TESTANDO CALLBACK DE EMERGÊNCIA');
  console.log('='.repeat(50));
  
  const tests = [
    { url: '/api/google/callback-emergency', desc: 'Callback emergência (sem parâmetros)' },
    { url: '/api/google/callback-emergency?error=access_denied', desc: 'Callback emergência (com erro)' },
    { url: '/api/google/callback-emergency?code=test&state=test', desc: 'Callback emergência (com sucesso)' }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n🧪 ${test.desc}`);
      console.log(`URL: ${baseUrl}${test.url}`);
      
      const response = await fetch(`${baseUrl}${test.url}`);
      console.log(`Status: ${response.status}`);
      
      const contentType = response.headers.get('content-type');
      console.log(`Content-Type: ${contentType}`);
      
      const text = await response.text();
      
      if (text.includes('window.location.href')) {
        console.log('✅ HTML com redirecionamento JavaScript');
        
        // Extrair URL de redirecionamento
        const match = text.match(/window\.location\.href = '([^']+)'/);
        if (match) {
          console.log(`🎯 Redireciona para: ${match[1]}`);
        }
      } else {
        console.log('❌ HTML sem redirecionamento');
      }
      
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('💡 PRÓXIMO PASSO:');
  console.log('Se funcionar, vamos configurar o Google Cloud Console');
  console.log('para usar o callback de emergência');
}

testEmergencyCallback().catch(console.error);