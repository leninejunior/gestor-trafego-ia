/**
 * Trigger manual sync for Google Ads campaigns
 */

const clientId = '19ec44b5-a2c8-4410-bbb2-433f049f45ef'; // Dr Hérnia Andradina

async function triggerSync() {
  console.log('🔄 Iniciando sincronização manual do Google Ads...\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/google/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId,
        syncType: 'full',
        fullSync: true,
      }),
    });
    
    const data = await response.json();
    
    console.log('📡 Resposta da API:');
    console.log('Status:', response.status);
    console.log('Dados:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Sincronização iniciada com sucesso!');
      console.log(`   Conexões: ${data.summary?.successful || 0} de ${data.summary?.total || 0}`);
      console.log(`   Tempo estimado: ${data.summary?.estimatedTime || 0}s`);
    } else {
      console.log('\n❌ Erro ao iniciar sincronização');
      console.log('   Mensagem:', data.error || data.message);
    }
    
  } catch (error) {
    console.error('\n💥 Erro ao chamar API:', error.message);
  }
}

triggerSync();
