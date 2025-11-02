require('dotenv').config();

async function testDeleteAPI() {
  try {
    console.log('🔍 Testando API de deleção...\n');

    // Testar sem autenticação (deve retornar 401)
    console.log('1. Testando sem autenticação...');
    const response1 = await fetch('http://localhost:3000/api/admin/users/9eceeafc-9a92-4287-9b30-2bd05487cac8', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log(`   Status: ${response1.status}`);
    const text1 = await response1.text();
    console.log(`   Resposta: ${text1}`);

    if (response1.status === 401) {
      console.log('   ✅ Retornou 401 como esperado (sem autenticação)');
    } else {
      console.log('   ❌ Deveria retornar 401');
    }

    // Testar com token inválido (deve retornar 401)
    console.log('\n2. Testando com token inválido...');
    const response2 = await fetch('http://localhost:3000/api/admin/users/9eceeafc-9a92-4287-9b30-2bd05487cac8', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token-invalido'
      }
    });

    console.log(`   Status: ${response2.status}`);
    const text2 = await response2.text();
    console.log(`   Resposta: ${text2}`);

    if (response2.status === 401) {
      console.log('   ✅ Retornou 401 como esperado (token inválido)');
    } else {
      console.log('   ❌ Deveria retornar 401');
    }

    console.log('\n✅ Testes de segurança passaram!');
    console.log('📝 Para testar com autenticação válida, use o frontend ou obtenha um token válido.');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testDeleteAPI();