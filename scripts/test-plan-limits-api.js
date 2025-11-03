require('dotenv').config();

async function testPlanLimitsAPI() {
  console.log('🔍 Testando API /api/plan-limits...\n');

  try {
    const response = await fetch('http://localhost:3000/api/plan-limits', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.text();
    console.log('Response body:', data);

    if (response.ok) {
      try {
        const jsonData = JSON.parse(data);
        console.log('\n✅ API funcionando! Dados:', JSON.stringify(jsonData, null, 2));
      } catch (parseError) {
        console.log('❌ Erro ao fazer parse do JSON:', parseError);
      }
    } else {
      console.log('❌ API retornou erro:', response.status);
    }

  } catch (error) {
    console.error('❌ Erro ao chamar API:', error);
  }
}

testPlanLimitsAPI();