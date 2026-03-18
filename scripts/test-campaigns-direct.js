/**
 * Teste DIRETO de busca de campanhas
 * Usa o client diretamente sem passar pelo endpoint HTTP
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testCampaignsDirect() {
  console.log('🔍 Testando busca de campanhas DIRETAMENTE...\n');

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
    customer_id: connection.customer_id,
    account_name: connection.account_name,
  });

  // Buscar chave de criptografia
  const { data: keys } = await supabase
    .from('google_ads_encryption_keys')
    .select('*')
    .eq('is_active', true)
    .limit(1);

  if (!keys || keys.length === 0) {
    console.error('❌ Nenhuma chave de criptografia encontrada');
    return;
  }

  console.log('✅ Chave de criptografia encontrada');

  // Importar o client
  const { GoogleAdsClient } = require('../src/lib/google/client.ts');
  
  try {
    // Criar client
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

    console.log('\n📊 Resultado:');
    console.log('Total de campanhas:', campaigns.length);
    
    if (campaigns.length > 0) {
      console.log('\n✅ Campanhas encontradas:');
      campaigns.forEach((campaign, index) => {
        console.log(`\n${index + 1}. ${campaign.name}`);
        console.log(`   ID: ${campaign.id}`);
        console.log(`   Status: ${campaign.status}`);
        console.log(`   Budget: R$ ${campaign.budget}`);
        console.log(`   Impressões: ${campaign.metrics.impressions}`);
        console.log(`   Cliques: ${campaign.metrics.clicks}`);
      });
    } else {
      console.log('\n⚠️  Nenhuma campanha retornada');
      console.log('Verifique:');
      console.log('1. Se a conta tem campanhas ativas');
      console.log('2. Se o customer_id está correto');
      console.log('3. Se o Developer Token está aprovado');
    }

  } catch (error) {
    console.error('\n❌ Erro ao buscar campanhas:');
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.message.includes('403')) {
      console.log('\n💡 Erro 403 - Possíveis causas:');
      console.log('1. Developer Token não aprovado');
      console.log('2. Usuário OAuth sem permissões na conta');
      console.log('3. Conta precisa de login-customer-id (MCC)');
    }
  }
}

testCampaignsDirect().catch(console.error);
