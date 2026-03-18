require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInsightsDates() {
  console.log('🔍 Verificando datas dos insights...\n');

  // Buscar insights de adsets
  const { data: adsetInsights, error } = await supabase
    .from('meta_adset_insights')
    .select('*')
    .order('date_start', { ascending: false });

  if (error) {
    console.error('❌ Erro:', error);
    return;
  }

  console.log(`✅ ${adsetInsights.length} insights de adsets encontrados\n`);

  // Calcular período dos últimos 30 dias
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  console.log('📅 Período "Últimos 30 dias":');
  console.log('   Desde:', thirtyDaysAgo.toISOString().split('T')[0]);
  console.log('   Até:', today.toISOString().split('T')[0]);
  console.log('');

  adsetInsights.forEach((insight, index) => {
    const dateStart = new Date(insight.date_start);
    const dateStop = new Date(insight.date_stop);
    const isInRange = dateStart >= thirtyDaysAgo && dateStop <= today;

    console.log(`🎯 Insight ${index + 1}:`);
    console.log('   AdSet ID:', insight.adset_id);
    console.log('   Período:', `${insight.date_start} a ${insight.date_stop}`);
    console.log('   Dentro dos últimos 30 dias?', isInRange ? '✅ SIM' : '❌ NÃO');
    console.log('   Gasto:', insight.spend);
    console.log('   Impressões:', insight.impressions);
    console.log('   Cliques:', insight.clicks);
    console.log('');
  });

  // Verificar insights de ads também
  const { data: adInsights } = await supabase
    .from('meta_ad_insights')
    .select('*')
    .order('date_start', { ascending: false });

  console.log(`\n✅ ${adInsights?.length || 0} insights de ads encontrados\n`);

  if (adInsights && adInsights.length > 0) {
    adInsights.slice(0, 3).forEach((insight, index) => {
      const dateStart = new Date(insight.date_start);
      const dateStop = new Date(insight.date_stop);
      const isInRange = dateStart >= thirtyDaysAgo && dateStop <= today;

      console.log(`🎯 Ad Insight ${index + 1}:`);
      console.log('   Ad ID:', insight.ad_id);
      console.log('   Período:', `${insight.date_start} a ${insight.date_stop}`);
      console.log('   Dentro dos últimos 30 dias?', isInRange ? '✅ SIM' : '❌ NÃO');
      console.log('   Gasto:', insight.spend);
      console.log('');
    });
  }

  console.log('\n✅ Verificação concluída!');
}

checkInsightsDates();
