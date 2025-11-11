/**
 * Testar callback no localhost
 */

const baseUrl = 'http://localhost:3000';

async function testLocalhostCallback() {
  console.log('🔍 TESTANDO CALLBACK NO LOCALHOST');
  console.log('='.repeat(50));
  
  try {
    // Testar callback com erro simulado
    const url = `${baseUrl}/api/google/callback?error=access_denied`;
    console.log('URL:', url);
    
    const response = await fetch(url);
    console.log('Status:', response.status);
    console.log('Headers importantes:');
    console.log('- content-type:', response.headers.get('content-type'));
    console.log('- location:', response.headers.get('location'));
    
    if (response.status === 302 || response.status === 307) {
      console.log('✅ SUCESSO! Callback redirecionou');
      const location = response.headers.get('location');
      console.log('Redirecionou para:', location);
      
      if (location && location.includes('error=oauth_error')) {
        console.log('✅ Tratamento de erro OAuth funcionando');
      }
    } else if (response.status === 200) {
      const text = await response.text();
      if (text.includes('<!DOCTYPE html>')) {
        console.log('❌ Ainda retorna HTML');
      } else {
        console.log('✅ Retorna JSON (API funcionando)');
        console.log('Resposta:', text.substring(0, 200));
      }
    } else {
      console.log('Status inesperado:', response.status);
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('⚠️ Servidor não está rodando');
      console.log('Execute: pnpm dev');
    } else {
      console.error('❌ Erro:', error.message);
    }
  }
  
  console.log('\n' + '='.repeat(50));
}

testLocalhostCallback().catch(console.error);