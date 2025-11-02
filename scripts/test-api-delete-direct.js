require('dotenv').config();

async function testApiDeleteDirect() {
  try {
    console.log('🔍 Testando API de deleção diretamente...\n');

    // Simular uma requisição DELETE para a API
    const userIdToDelete = '9eceeafc-9a92-4287-9b30-2bd05487cac8'; // ID do usuário teste@exemplo.co
    
    // Primeiro, vamos verificar se o servidor está rodando
    try {
      const healthCheck = await fetch('http://localhost:3000/api/health');
      console.log('✅ Servidor está rodando');
    } catch (error) {
      console.log('❌ Servidor não está rodando. Inicie com: npm run dev');
      return;
    }

    // Testar sem autenticação
    console.log('Testando sem autenticação...');
    const response1 = await fetch(`http://localhost:3000/api/admin/users/${userIdToDelete}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log(`Status: ${response1.status}`);
    const responseText1 = await response1.text();
    console.log('Resposta:', responseText1);

    // Se retornou 401, é esperado
    if (response1.status === 401) {
      console.log('✅ Retornou 401 sem autenticação, como esperado');
    }

    // Agora vamos tentar com um token simulado (isso não vai funcionar, mas vamos ver o erro)
    console.log('\nTestando com token simulado...');
    const response2 = await fetch(`http://localhost:3000/api/admin/users/${userIdToDelete}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token'
      }
    });

    console.log(`Status: ${response2.status}`);
    const responseText2 = await response2.text();
    console.log('Resposta:', responseText2);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testApiDeleteDirect();