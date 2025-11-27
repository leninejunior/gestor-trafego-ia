/**
 * Teste direto do Google Ads Client
 * Testa se consegue buscar campanhas diretamente
 */

require('dotenv').config();

async function testGoogleClient() {
  console.log('🔍 Testando Google Ads Client diretamente...\n');

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Buscar conexão ativa
  const { data: connections, error } = await supabase
    .from('google_ads_connections')
    .select('*')
    .eq('status', 'active')
    .limit(1);

  if (error || !connections || connections.length === 0) {
    console.error('❌ Nenhuma conexão ativa encontrada');
    return;
  }

  const connection = connections[0];
  console.log('✅ Conexão encontrada:', {
    id: connection.id,
    customerId: connection.customer_id,
    hasRefreshToken: !!connection.refresh_token,
    hasAccessToken: !!connection.access_token,
    tokenExpiresAt: connection.token_expires_at,
  });

  // Importar o client
  const { GoogleAdsClient } = require('../src/lib/google/client.ts');
  
  try {
    // Criar instância do client
    const client = new GoogleAdsClient({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      developerToken: process.env.GOOGLE_DEVELOPER_TOKEN,
      refreshToken: connection.refresh_token,
      customerId: connection.customer_id,
      connectionId: connection.id,
    });

    console.log('\n📡 Buscando campanhas...\n');

    // Buscar campanhas
    const campaigns = await client.getCampaigns();

    console.log('\n✅ Campanhas encontradas:', campaigns.length);
    
    if (campaigns.length > 0) {
      console.log('\n📊 Primeiras 3 campanhas:');
      campaigns.slice(0, 3).forEach((campaign, i) => {
        console.log(`\n${i + 1}. ${campaign.name}`);
        console.log(`   ID: ${campaign.id}`);
        console.log(`   Status: ${campaign.status}`);
        console.log(`   Budget: R$ ${campaign.budget}`);
        console.log(`   Impressões: ${campaign.metrics.impressions}`);
        console.log(`   Cliques: ${campaign.metrics.clicks}`);
      });
    } else {
      console.log('\n⚠️ Nenhuma campanha retornada');
      console.log('Verifique:');
      console.log('1. Se a conta tem campanhas ativas');
      console.log('2. Se o Developer Token está aprovado');
      console.log('3. Se o usuário OAuth tem permissões na conta');
    }

  } catch (error) {
    console.error('\n❌ Erro ao buscar campanhas:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
    });
  }
}

testGoogleClient().catch(console.error);
