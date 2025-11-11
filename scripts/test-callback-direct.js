/**
 * Testar callback diretamente
 */

const baseUrl = 'https://gestor.engrene.com';

async function testCallbackDirect() {
  console.log('🔍 TESTANDO CALLBACK DIRETAMENTE');
  console.log('='.repeat(50));
  
  try {
    // Testar diferentes URLs de callback
    const callbackUrls = [
      `${baseUrl}/api/google/callback`,
      `${baseUrl}/api/google/callback?test=1`,
      `${baseUrl}/api/google/callback?error=test`,
    ];
    
    for (const url of callbackUrls) {
      console.log(`\n📡 Testando: ${url}`);
      
      const response = await fetch(url);
      console.log('Status:', response.status);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.status === 302 || response.status === 307) {
        console.log('✅ Redirecionamento funcionando');
      } else if (response.status === 404) {
        console.log('❌ Rota não encontrada');
      } else {
        const text = await response.text();
        console.log('Resposta:', text.substring(0, 100));
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
  
  console.log('\n' + '='.repeat(50));
}

testCallbackDirect().catch(console.error);