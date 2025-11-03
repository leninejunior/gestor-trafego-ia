require('dotenv').config();

async function testAPIDirect() {
  console.log('🔍 Testando API diretamente...\n');

  try {
    // Fazer uma requisição GET para a API
    const response = await fetch('http://localhost:3000/api/plan-limits', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Test Script'
      }
    });

    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    const responseText = await response.text();
    console.log('Response Body:', responseText);

    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('\n✅ Dados parseados:', JSON.stringify(data, null, 2));
      } catch (parseError) {
        console.log('❌ Erro ao fazer parse:', parseError);
      }
    } else {
      console.log('❌ Erro na API:', response.status, response.statusText);
    }

  } catch (error) {
    console.error('❌ Erro na requisição:', error);
  }
}

testAPIDirect();