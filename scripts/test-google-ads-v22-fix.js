/**
 * Teste para verificar se a correção da API v22 funciona
 * Testa o endpoint de campanhas com o endpoint correto
 */

require('dotenv').config();

const { GoogleAdsClient } = require('../src/lib/google/client.js');

async function testGoogleAdsV22Fix() {
  console.log('🔧 Testando correção Google Ads API v22...\n');

  try {
    // Buscar conexão ativa do banco
    const { createClient } = require('../src/lib/supabase/server.js');
    const supabase = await createClient();

    const { data: connection, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('status', 'active')
      .single();

    if (connError || !connection) {
      console.error('❌ Nenhuma conexão ativa encontrada');
      return;
    }

    console.log('✅ Conexão encontrada:', {
      id: connection.id,
      customer_id: connection.customer_id,
      status: connection.status
    });

    // Criar cliente Google Ads com a conexão
    const client = new GoogleAdsClient({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      developerToken: process.env.GOOGLE_DEVELOPER_TOKEN,
      refreshToken: connection.refresh_token,
      customerId: connection.customer_id,
      connectionId: connection.id
    });

    console.log('\n🔍 Buscando campanhas com endpoint corrigido...');

    // Testar busca de campanhas
    const campaigns = await client.getCampaigns();

    console.log('\n✅ RESULTADO:');
    console.log(`- Campanhas encontradas: ${campaigns.length}`);
    
    if (campaigns.length > 0) {
      console.log('- Primeira campanha:', {
        id: campaigns[0].id,
        name: campaigns[0].name,
        status: campaigns[0].status,
        impressions: campaigns[0].metrics.impressions,
        clicks: campaigns[0].metrics.clicks,
        cost: campaigns[0].metrics.cost
      });
    }

    console.log('\n🎯 Teste concluído com sucesso!');

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:');
    console.error('Mensagem:', error.message);
    console.error('Código:', error.code);
    console.error('Status:', error.status);
    
    if (error.message.includes('searchStream')) {
      console.error('\n💡 PROVÁVEL CAUSA: Ainda está usando searchStream em vez de search');
    }
    
    if (error.status === 403) {
      console.error('\n💡 PROVÁVEL CAUSA: Problema de permissões do Developer Token');
    }
  }
}

// Executar teste
testGoogleAdsV22Fix();