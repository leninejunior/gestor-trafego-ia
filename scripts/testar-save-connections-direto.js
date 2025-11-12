require('dotenv').config();

async function testar() {
  console.log('🧪 Testando rota /api/meta/save-connections...\n');
  
  const url = 'http://localhost:3000/api/meta/save-connections';
  
  const payload = {
    client_id: 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751',
    access_token: 'EAANKH54qO4cBPwZAuaJnwjQK2COabwYGl9bZCpRI8YZBgmCbx7bWW6NREZAiak54LXpPG1t7yodTz7uTD48ZCMjHrCe9kZCKLtCQEgyCvZAvJ0RJZCJAXXdOoKglFOrvZCsAHdaD5Pithyr71ZCXPFcYCqJHKWVAGKEjoTcY8qchWKz917gYLlK7YpGsAJkZAkE1mSkXRsjQcx9RTwo44R3CPfJLVw1ePZAPMkZBuNtPrJ4ZAaYmfLDnMGeKIu25N0Ozvm0q1CEu0TwT7hK4kTQeZBXeCedGWVZBXkCEu0PlfqCs',
    selected_accounts: ['act_1234567890'],
    ad_accounts: [
      { id: 'act_1234567890', name: 'Conta Teste' }
    ]
  };
  
  console.log('📦 Payload:', JSON.stringify(payload, null, 2));
  console.log('\n🔄 Enviando requisição...\n');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    console.log('📡 Status:', response.status);
    
    const data = await response.json();
    console.log('📊 Resposta:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Sucesso!');
    } else {
      console.log('\n❌ Erro!');
    }
    
  } catch (error) {
    console.error('💥 Erro na requisição:', error.message);
  }
}

testar();
