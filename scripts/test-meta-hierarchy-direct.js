/**
 * Script para testar hierarquia Meta Ads diretamente do banco
 * Usa service role key para bypass de RLS
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CLIENT_ID = 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751'; // BM Coan
const AD_ACCOUNT_ID = 'act_3656912201189816';

async function testHierarchy() {
  console.log('🚀 Testando hierarquia Meta Ads diretamente do banco...\n');
  
  // 1. Buscar conexão
  console.log('📊 1. BUSCANDO CONEXÃO');
  console.log('=====================================');
  const { data: connections, error: connError } = await supabase
    .from('client_meta_connections')
    .select('*')
    .eq('client_id', CLIENT_ID)
    .eq('ad_account_id', AD_ACCOUNT_ID);
  
  if (connError) {
    console.error('❌ Erro ao buscar conexão:', connError.message);
    return;
  }
  
  if (!connections || connections.length === 0) {
    console.error('❌ Nenhuma conexão encontrada');
    return;
  }
  
  const connection = connections[0]; // Usar a primeira conexão
  console.log(`✅ ${connections.length} conexão(ões) encontrada(s), usando a primeira:`, {
    id: connection.id,
    account_name: connection.account_name,
    is_active: connection.is_active
  });
  console.log('');
  
  // 2. Buscar campanhas
  console.log('📊 2. BUSCANDO CAMPANHAS');
  console.log('=====================================');
  const { data: campaigns, error: campaignsError } = await supabase
    .from('meta_campaigns')
    .select('*')
    .eq('connection_id', connection.id);
  
  if (campaignsError) {
    console.error('❌ Erro ao buscar campanhas:', campaignsError.message);
    return;
  }
  
  console.log(`✅ ${campaigns.length} campanhas encontradas`);
  campaigns.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name} (${c.external_id}) - ${c.status}`);
  });
  console.log('');
  
  if (campaigns.length === 0) {
    console.log('⚠️ Nenhuma campanha no banco. Execute sync-meta-campaigns.js primeiro');
    return;
  }
  
  // 3. Para cada campanha, buscar adsets
  for (const campaign of campaigns.slice(0, 3)) { // Limitar a 3 campanhas
    console.log(`📊 3. BUSCANDO ADSETS DA CAMPANHA: ${campaign.name}`);
    console.log('=====================================');
    
    const { data: adsets, error: adsetsError } = await supabase
      .from('meta_adsets')
      .select('*')
      .eq('campaign_id', campaign.id);
    
    if (adsetsError) {
      console.error('❌ Erro ao buscar adsets:', adsetsError.message);
      continue;
    }
    
    console.log(`✅ ${adsets.length} conjuntos encontrados`);
    adsets.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.name} (${a.external_id}) - ${a.status}`);
    });
    console.log('');
    
    // 4. Para cada adset, buscar ads
    for (const adset of adsets.slice(0, 2)) { // Limitar a 2 adsets
      console.log(`📊 4. BUSCANDO ADS DO ADSET: ${adset.name}`);
      console.log('=====================================');
      
      const { data: ads, error: adsError } = await supabase
        .from('meta_ads')
        .select('*')
        .eq('adset_id', adset.id);
      
      if (adsError) {
        console.error('❌ Erro ao buscar ads:', adsError.message);
        continue;
      }
      
      console.log(`✅ ${ads.length} anúncios encontrados`);
      ads.forEach((a, i) => {
        console.log(`  ${i + 1}. ${a.name} (${a.external_id}) - ${a.status}`);
      });
      console.log('');
    }
  }
  
  // 5. Resumo final
  console.log('📊 RESUMO FINAL');
  console.log('=====================================');
  
  const { count: totalCampaigns } = await supabase
    .from('meta_campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', connection.id);
  
  const { count: totalAdsets } = await supabase
    .from('meta_adsets')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', connection.id);
  
  const { count: totalAds } = await supabase
    .from('meta_ads')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', connection.id);
  
  console.log(`✅ Total de campanhas: ${totalCampaigns}`);
  console.log(`✅ Total de conjuntos: ${totalAdsets}`);
  console.log(`✅ Total de anúncios: ${totalAds}`);
  console.log('');
  
  if (totalCampaigns > 0 && totalAdsets === 0) {
    console.log('⚠️ PROBLEMA IDENTIFICADO: Há campanhas mas nenhum conjunto!');
    console.log('💡 SOLUÇÃO: Execute sync-meta-hierarchy-insights.js para sincronizar');
  } else if (totalAdsets > 0 && totalAds === 0) {
    console.log('⚠️ PROBLEMA IDENTIFICADO: Há conjuntos mas nenhum anúncio!');
    console.log('💡 SOLUÇÃO: Execute sync-meta-hierarchy-insights.js para sincronizar');
  } else if (totalCampaigns > 0 && totalAdsets > 0 && totalAds > 0) {
    console.log('✅ HIERARQUIA COMPLETA: Campanhas → Conjuntos → Anúncios');
    console.log('');
    console.log('🔍 Próximo passo: Verificar se a API está retornando os dados corretamente');
    console.log('   Execute: node scripts/diagnose-meta-hierarchy.js (com servidor rodando e usuário logado)');
  }
}

testHierarchy().catch(console.error);
