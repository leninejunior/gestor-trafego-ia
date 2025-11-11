/**
 * Teste detalhado do callback para debug
 */

const baseUrl = 'https://gestor.engrene.com';

async function testCallbackWithDetails() {
  console.log('🔍 TESTE DETALHADO DO CALLBACK');
  console.log('='.repeat(50));
  
  try {
    const url = `${baseUrl}/api/google/callback?test=true`;
    console.log(`\n📡 Testando: ${url}`);
    
    const response = await fetch(url);
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    console.log(`Cache-Control: ${response.headers.get('cache-control')}`);
    
    const text = await response.text();
    console.log(`\n📄 Conteúdo da resposta (primeiros 500 chars):`);
    console.log(text.substring(0, 500));
    
    if (text.includes('window.location.href')) {
      console.log('\n✅ SUCESSO: Callback forçado funcionando!');
    } else if (text.includes('<!DOCTYPE html>')) {
      console.log('\n⚠️ HTML retornado, mas não é o callback forçado');
    } else {
      console.log('\n❌ Resposta não é HTML');
    }
    
  } catch (error) {
    console.error(`❌ Erro: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(50));
}

testCallbackWithDetails().catch(console.error);