require('dotenv').config();

console.log('🔍 TESTANDO CORREÇÃO DO DATABASE HEALTH CHECK\n');

async function testarHealthCheck() {
  try {
    console.log('📡 Testando novo health check...');
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      },
    });
    
    console.log('Status:', response.status);
    console.log('OK:', response.ok);
    
    if (response.ok) {
      console.log('\n✅ SUCESSO! O health check agora funciona corretamente!');
      console.log('\n💡 PRÓXIMOS PASSOS:');
      console.log('1. O servidor Next.js vai detectar a mudança automaticamente');
      console.log('2. O log "database status: unavailable" deve desaparecer');
      console.log('3. Verifique o terminal do servidor para confirmar');
    } else {
      console.log('\n❌ ERRO: Health check ainda falha');
      console.log('Status:', response.status);
    }
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
  }
}

testarHealthCheck();
