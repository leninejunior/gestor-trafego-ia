require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function verifyCampaigns() {
  console.log('🔍 Verificando campanhas no banco de dados...');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Buscar todas as campanhas do cliente
    const { data: campaigns, error } = await supabase
      .from('google_ads_campaigns')
      .select(`
        *,
        connection:google_ads_connections(
          customer_id,
          status
        )
      `)
      .eq('client_id', '19ec44b5-a2c8-4410-bbb2-433f049f45ef')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar campanhas:', error);
      return;
    }

    console.log(`✅ Encontradas ${campaigns?.length || 0} campanhas no banco:`);
    
    if (campaigns && campaigns.length > 0) {
      campaigns.forEach((campaign, index) => {
        console.log(`\n📊 Campanha ${index + 1}:`);
        console.log(`   ID: ${campaign.id}`);
        console.log(`   Campaign ID (Google): ${campaign.campaign_id}`);
        console.log(`   Nome: ${campaign.campaign_name}`);
        console.log(`   Status: ${campaign.status}`);
        console.log(`   Orçamento: $${campaign.budget_amount}`);
        console.log(`   Moeda: ${campaign.budget_currency}`);
        console.log(`   Data início: ${campaign.start_date}`);
        console.log(`   Data fim: ${campaign.end_date}`);
        console.log(`   Conexão: ${campaign.connection?.customer_id} (${campaign.connection?.status})`);
        console.log(`   Data de criação: ${campaign.created_at}`);
        console.log(`   Data de atualização: ${campaign.updated_at}`);
      });
    } else {
      console.log('⚠️ Nenhuma campanha encontrada no banco de dados.');
    }

    // Verificar também as conexões ativas
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('client_id', '19ec44b5-a2c8-4410-bbb2-433f049f45ef')
      .eq('status', 'active');

    if (connError) {
      console.error('❌ Erro ao buscar conexões:', connError);
      return;
    }

    console.log(`\n🔗 Conexões ativas: ${connections?.length || 0}`);
    connections?.forEach(conn => {
      console.log(`   - Customer ID: ${conn.customer_id} (${conn.status})`);
      console.log(`     Última sincronização: ${conn.last_sync_at}`);
    });

  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

verifyCampaigns();