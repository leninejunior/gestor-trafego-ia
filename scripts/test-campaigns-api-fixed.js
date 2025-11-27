require('dotenv').config();

async function testCampaignsAPI() {
  console.log('🔧 Testando API de campanhas Google Ads (após correção)...');
  
  try {
    // Testar a API diretamente
    const campaignsUrl = `http://localhost:3000/api/google/campaigns?clientId=19ec44b5-a2c8-4410-bbb2-433f049f45ef`;
    
    console.log('🔍 Testando /api/google/campaigns via fetch...');

    const response = await fetch(campaignsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('📊 Status da resposta:', { 
      status: response.status, 
      ok: response.ok 
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCESSO - Campanhas encontradas:');
      console.log(`   Total: ${data.count || 0}`);
      
      if (data.campaigns && data.campaigns.length > 0) {
        data.campaigns.forEach((campaign, index) => {
          console.log(`\n📊 Campanha ${index + 1}:`);
          console.log(`   ID: ${campaign.id}`);
          console.log(`   Campaign ID (Google): ${campaign.campaign_id}`);
          console.log(`   Nome: ${campaign.name}`);
          console.log(`   Status: ${campaign.status}`);
          console.log(`   Orçamento (micros): ${campaign.budget_amount_micros}`);
          console.log(`   Orçamento (formatado): $${(campaign.budget_amount_micros || 0) / 1000000}`);
          console.log(`   Conexão: ${campaign.connection?.customer_id} (${campaign.connection?.status})`);
          console.log(`   Data de criação: ${campaign.created_at}`);
          console.log(`   Data de atualização: ${campaign.updated_at}`);
        });
      }
    } else {
      console.log('❌ ERRO NA API:');
      console.log('- Mensagem:', data.message || 'Sem mensagem');
      console.log('- Detalhes:', data.details || 'Sem detalhes');
      console.log('- Erro:', data.error || 'Sem erro');
    }

  } catch (error) {
    console.error('💥 Erro geral:', error.message);
  }
}

testCampaignsAPI();