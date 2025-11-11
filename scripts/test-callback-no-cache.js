/**
 * Testar callback sem cache
 */

const baseUrl = 'https://gestor.engrene.com';

async function testCallbackNoCache() {
  console.log('🔍 TESTANDO CALLBACK SEM CACHE');
  console.log('='.repeat(50));
  
  try {
    // Adicionar timestamp para evitar cache
    const timestamp = Date.now();
    const url = `${baseUrl}/api/google/callback?t=${timestamp}&error=access_denied`;
    
    console.log(`📡 Testando: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    console.log('Status:', response.status);
    console.log('Headers importantes:');
    console.log('- x-matched-path:', response.headers.get('x-matched-path'));
    console.log('- x-vercel-cache:', response.headers.get('x-vercel-cache'));
    console.log('- content-type:', response.headers.get('content-type'));
    console.log('- location:', response.headers.get('location'));
    
    if (response.status === 302 || response.status === 307) {
      console.log('✅ SUCESSO! Callback redirecionou');
      const location = response.headers.get('location');
      console.log('Redirecionou para:', location);
    } else if (response.status === 200) {
      const text = await response.text();
      if (text.includes('<!DOCTYPE html>')) {
        console.log('❌ Ainda retorna HTML (página de login)');
        console.log('Problema: Middleware ou cache ainda interceptando');
      } else {
        console.log('✅ Retorna JSON (API funcionando)');
      }
    } else {
      console.log('Status inesperado:', response.status);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('💡 AGUARDE alguns minutos para o deploy do middleware');
  console.log('💡 Ou teste diretamente no navegador após fazer login');
}

testCallbackNoCache().catch(console.error);