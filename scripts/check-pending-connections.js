/**
 * Verificar conexões pendentes no banco
 */

const baseUrl = 'https://gestor.engrene.com';

async function checkPendingConnections() {
  console.log('🔍 VERIFICANDO CONEXÕES PENDENTES');
  console.log('='.repeat(50));
  
  const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77';
  
  try {
    const url = `${baseUrl}/api/debug/check-pending-connections?clientId=${clientId}`;
    console.log('URL:', url);
    
    const response = await fetch(url);
    console.log('Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n📊 RESULTADO:');
      console.log('- Total de conexões:', data.totalConnections);
      console.log('- Conexões pendentes:', data.pendingConnections);
      console.log('- Conexões ativas:', data.activeConnections);
      
      if (data.connections && data.connections.length > 0) {
        console.log('\n📋 TODAS AS CONEXÕES:');
        data.connections.forEach((conn, index) => {
          console.log(`${index + 1}. ID: ${conn.id}`);
          console.log(`   - Customer ID: ${conn.customer_id}`);
          console.log(`   - Status: ${conn.status}`);
          console.log(`   - Criado: ${conn.created_at}`);
          console.log(`   - Atualizado: ${conn.updated_at}`);
        });
      }
      
      if (data.pendingDetails && data.pendingDetails.length > 0) {
        console.log('\n⏸️ CONEXÕES PENDENTES:');
        data.pendingDetails.forEach((conn, index) => {
          console.log(`${index + 1}. ID: ${conn.id}`);
          console.log(`   - Customer ID: ${conn.customer_id}`);
          console.log(`   - Status: ${conn.status}`);
        });
      } else {
        console.log('\n⚠️ NENHUMA CONEXÃO PENDENTE ENCONTRADA');
        console.log('Isso explica por que a página de seleção não aparece!');
      }
      
    } else {
      const errorText = await response.text();
      console.log('❌ Erro:', errorText.substring(0, 200));
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 VERIFICAÇÃO CONCLUÍDA');
}

// Executar verificação
checkPendingConnections().catch(console.error);