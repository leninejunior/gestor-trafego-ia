/**
 * Script de Diagnóstico - Meta Ads Insights
 * 
 * Verifica por que adsets e ads estão mostrando zeros nas métricas
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseInsights() {
  console.log('🔍 DIAGNÓSTICO DE INSIGHTS META ADS\n');
  console.log('=' .repeat(60));

  try {
    // 1. Buscar uma conexão ativa
    console.log('\n1️⃣ Buscando conexão Meta Ads ativa...');
    const { data: connection, error: connError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (connError || !connection) {
      console.error('❌ Nenhuma conexão ativa encontrada');
      return;
    }

    console.log('✅ Conexão encontrada:', {
      id: connection.id,
      client_id: connection.client_id,
      ad_account_id: connection.ad_account_id,
      account_name: connection.account_name
    });

    // 2. Buscar campanhas
    console.log('\n2️⃣ Buscando campanhas da Meta API...');
    const campaignsUrl = `https://graph.facebook.com/v18.0/act_${connection.ad_account_id}/campaigns`;
    const campaignsParams = new URLSearchParams({
      access_token: connection.access_token,
      fields: 'id,name,status',
      limit: '3'
    });

    const campaignsRes = await fetch(`${campaignsUrl}?${campaignsParams}`);
    const campaignsData = await campaignsRes.json();

    if (campaignsData.error) {
      console.error('❌ Erro ao buscar campanhas:', campaignsData.error);
      return;
    }

    console.log(`✅ ${campaignsData.data?.length || 0} campanhas encontradas`);

    if (!campaignsData.data || campaignsData.data.length === 0) {
      console.log('⚠️ Nenhuma campanha para testar');
      return;
    }

    const campaign = campaignsData.data[0];
    console.log('\n📊 Testando campanha:', campaign.name);

    // 3. Buscar insights da campanha
    console.log('\n3️⃣ Buscando insights da campanha...');
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const until = new Date().toISOString().split('T')[0];

    const campaignInsightsUrl = `https://graph.facebook.com/v18.0/${campaign.id}/insights`;
    const campaignInsightsParams = new URLSearchParams({
      access_token: connection.access_token,
      fields: 'impressions,clicks,spend,reach,ctr,cpc',
      time_range: JSON.stringify({ since, until })
    });

    const campaignInsightsRes = await fetch(`${campaignInsightsUrl}?${campaignInsightsParams}`);
    const campaignInsightsData = await campaignInsightsRes.json();

    console.log('📈 Insights da campanha:', {
      hasData: !!campaignInsightsData.data?.[0],
      data: campaignInsightsData.data?.[0] || 'Sem dados',
      error: campaignInsightsData.error
    });

    // 4. Buscar adsets
    console.log('\n4️⃣ Buscando adsets da campanha...');
    const adsetsUrl = `https://graph.facebook.com/v18.0/${campaign.id}/adsets`;
    const adsetsParams = new URLSearchParams({
      access_token: connection.access_token,
      fields: 'id,name,status',
      limit: '2'
    });

    const adsetsRes = await fetch(`${adsetsUrl}?${adsetsParams}`);
    const adsetsData = await adsetsRes.json();

    if (adsetsData.error) {
      console.error('❌ Erro ao buscar adsets:', adsetsData.error);
      return;
    }

    console.log(`✅ ${adsetsData.data?.length || 0} adsets encontrados`);

    if (!adsetsData.data || adsetsData.data.length === 0) {
      console.log('⚠️ Nenhum adset para testar');
      return;
    }

    const adset = adsetsData.data[0];
    console.log('\n📊 Testando adset:', adset.name);

    // 5. Buscar insights do adset
    console.log('\n5️⃣ Buscando insights do adset...');
    const adsetInsightsUrl = `https://graph.facebook.com/v18.0/${adset.id}/insights`;
    const adsetInsightsParams = new URLSearchParams({
      access_token: connection.access_token,
      fields: 'impressions,clicks,spend,reach,ctr,cpc',
      time_range: JSON.stringify({ since, until })
    });

    const adsetInsightsRes = await fetch(`${adsetInsightsUrl}?${adsetInsightsParams}`);
    const adsetInsightsData = await adsetInsightsRes.json();

    console.log('📈 Insights do adset:', {
      hasData: !!adsetInsightsData.data?.[0],
      data: adsetInsightsData.data?.[0] || 'Sem dados',
      error: adsetInsightsData.error
    });

    // 6. Buscar ads
    console.log('\n6️⃣ Buscando ads do adset...');
    const adsUrl = `https://graph.facebook.com/v18.0/${adset.id}/ads`;
    const adsParams = new URLSearchParams({
      access_token: connection.access_token,
      fields: 'id,name,status',
      limit: '2'
    });

    const adsRes = await fetch(`${adsUrl}?${adsParams}`);
    const adsData = await adsRes.json();

    if (adsData.error) {
      console.error('❌ Erro ao buscar ads:', adsData.error);
      return;
    }

    console.log(`✅ ${adsData.data?.length || 0} ads encontrados`);

    if (!adsData.data || adsData.data.length === 0) {
      console.log('⚠️ Nenhum ad para testar');
      return;
    }

    const ad = adsData.data[0];
    console.log('\n📊 Testando ad:', ad.name);

    // 7. Buscar insights do ad
    console.log('\n7️⃣ Buscando insights do ad...');
    const adInsightsUrl = `https://graph.facebook.com/v18.0/${ad.id}/insights`;
    const adInsightsParams = new URLSearchParams({
      access_token: connection.access_token,
      fields: 'impressions,clicks,spend,reach,ctr,cpc',
      time_range: JSON.stringify({ since, until })
    });

    const adInsightsRes = await fetch(`${adInsightsUrl}?${adInsightsParams}`);
    const adInsightsData = await adInsightsRes.json();

    console.log('📈 Insights do ad:', {
      hasData: !!adInsightsData.data?.[0],
      data: adInsightsData.data?.[0] || 'Sem dados',
      error: adInsightsData.error
    });

    // 8. Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMO DO DIAGNÓSTICO\n');
    console.log('Período testado:', `${since} até ${until}`);
    console.log('\nCampanha:', campaign.name);
    console.log('  ├─ Tem insights?', !!campaignInsightsData.data?.[0] ? '✅ SIM' : '❌ NÃO');
    if (campaignInsightsData.data?.[0]) {
      console.log('  ├─ Impressões:', campaignInsightsData.data[0].impressions || '0');
      console.log('  ├─ Cliques:', campaignInsightsData.data[0].clicks || '0');
      console.log('  └─ Gasto:', campaignInsightsData.data[0].spend || '0');
    }

    console.log('\nAdset:', adset.name);
    console.log('  ├─ Tem insights?', !!adsetInsightsData.data?.[0] ? '✅ SIM' : '❌ NÃO');
    if (adsetInsightsData.data?.[0]) {
      console.log('  ├─ Impressões:', adsetInsightsData.data[0].impressions || '0');
      console.log('  ├─ Cliques:', adsetInsightsData.data[0].clicks || '0');
      console.log('  └─ Gasto:', adsetInsightsData.data[0].spend || '0');
    }

    console.log('\nAd:', ad.name);
    console.log('  ├─ Tem insights?', !!adInsightsData.data?.[0] ? '✅ SIM' : '❌ NÃO');
    if (adInsightsData.data?.[0]) {
      console.log('  ├─ Impressões:', adInsightsData.data[0].impressions || '0');
      console.log('  ├─ Cliques:', adInsightsData.data[0].clicks || '0');
      console.log('  └─ Gasto:', adInsightsData.data[0].spend || '0');
    }

    // 9. Possíveis causas
    console.log('\n' + '='.repeat(60));
    console.log('🔍 POSSÍVEIS CAUSAS SE ZEROS:\n');
    
    const hasAnyCampaignData = !!campaignInsightsData.data?.[0];
    const hasAnyAdsetData = !!adsetInsightsData.data?.[0];
    const hasAnyAdData = !!adInsightsData.data?.[0];

    if (!hasAnyCampaignData && !hasAnyAdsetData && !hasAnyAdData) {
      console.log('❌ Nenhum dado em nenhum nível');
      console.log('   Possíveis causas:');
      console.log('   1. Campanhas não tiveram impressões no período');
      console.log('   2. Campanhas estão pausadas/inativas');
      console.log('   3. Período de datas incorreto');
      console.log('   4. Conta sem orçamento/pagamento');
    } else if (hasAnyCampaignData && !hasAnyAdsetData && !hasAnyAdData) {
      console.log('⚠️ Campanha tem dados, mas adsets/ads não');
      console.log('   Possíveis causas:');
      console.log('   1. Adsets/ads foram criados recentemente');
      console.log('   2. Adsets/ads estão pausados');
      console.log('   3. Problema na API de insights de adsets/ads');
    } else if (hasAnyCampaignData && hasAnyAdsetData && !hasAnyAdData) {
      console.log('⚠️ Campanha e adsets têm dados, mas ads não');
      console.log('   Possíveis causas:');
      console.log('   1. Ads foram criados recentemente');
      console.log('   2. Ads estão pausados');
      console.log('   3. Problema na API de insights de ads');
    } else {
      console.log('✅ Todos os níveis têm dados!');
      console.log('   Se ainda vê zeros na UI, o problema pode ser:');
      console.log('   1. Filtro de datas diferente na UI');
      console.log('   2. Problema no código de exibição');
      console.log('   3. Cache do navegador');
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
  }
}

diagnoseInsights();
