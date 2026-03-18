require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAdsetsAPI() {
  console.log('🧪 Testando API de AdSets...\n');

  // Usar o ID da primeira campanha que tem adsets
  const campaignId = '63e9c58f-474b-4a27-9634-3122f88ec20e';
  
  console.log('📋 Teste 1: Buscar campanha por ID interno');
  console.log('Campaign ID:', campaignId);
  
  const { data: campaign, error: campaignError } = await supabase
    .from('meta_campaigns')
    .select('id, connection_id, external_id, name')
    .eq('id', campaignId)
    .single();

  if (campaignError) {
    console.error('❌ Erro ao buscar campanha:', campaignError);
  } else {
    console.log('✅ Campanha encontrada:', campaign);
  }

  console.log('\n📋 Teste 2: Buscar adsets da campanha');
  
  const { data: adsets, error: adsetsError } = await supabase
    .from('meta_adsets')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('name');

  if (adsetsError) {
    console.error('❌ Erro ao buscar adsets:', adsetsError);
  } else {
    console.log(`✅ ${adsets?.length || 0} adsets encontrados`);
    adsets?.forEach((adset, i) => {
      console.log(`\n   Adset ${i + 1}:`);
      console.log(`   - ID: ${adset.id}`);
      console.log(`   - Nome: ${adset.name}`);
      console.log(`   - Status: ${adset.status}`);
      console.log(`   - Campaign ID: ${adset.campaign_id}`);
    });
  }

  console.log('\n📋 Teste 3: Buscar insights dos adsets');
  
  if (adsets && adsets.length > 0) {
    for (const adset of adsets) {
      const { data: insights, error: insightsError } = await supabase
        .from('meta_adset_insights')
        .select('*')
        .eq('adset_id', adset.id);

      if (insightsError) {
        console.error(`❌ Erro ao buscar insights do adset ${adset.id}:`, insightsError);
      } else {
        console.log(`\n   Insights do adset "${adset.name}":`);
        console.log(`   - ${insights?.length || 0} registros encontrados`);
        if (insights && insights.length > 0) {
          const total = insights.reduce((acc, i) => ({
            spend: acc.spend + Number(i.spend || 0),
            impressions: acc.impressions + Number(i.impressions || 0),
            clicks: acc.clicks + Number(i.clicks || 0),
          }), { spend: 0, impressions: 0, clicks: 0 });
          console.log(`   - Total gasto: R$ ${total.spend.toFixed(2)}`);
          console.log(`   - Total impressões: ${total.impressions}`);
          console.log(`   - Total cliques: ${total.clicks}`);
        }
      }
    }
  }

  console.log('\n✅ Teste concluído!');
}

testAdsetsAPI().catch(console.error);
