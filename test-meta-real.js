/**
 * Teste REAL da hierarquia Meta Ads
 * Busca client_id do banco e testa campanhas -> adsets -> ads
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Credenciais via ambiente
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variáveis ausentes: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_KEY).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testMetaHierarchy() {
  console.log('🔍 TESTE REAL DA HIERARQUIA META ADS\n');
  
  try {
    // 1. Buscar um cliente com conexão Meta ativa
    console.log('1️⃣ Buscando cliente com conexão Meta...');
    const { data: connections, error: connError } = await supabase
      .from('client_meta_connections')
      .select('client_id, ad_account_id, account_name, is_active')
      .eq('is_active', true)
      .limit(1);
    
    if (connError) throw connError;
    if (!connections || connections.length === 0) {
      console.log('❌ Nenhuma conexão Meta ativa encontrada!');
      console.log('💡 Conecte uma conta Meta primeiro em: http://localhost:3000/dashboard/clients/[clientId]');
      return;
    }
    
    const { client_id, ad_account_id, account_name } = connections[0];
    console.log(`✅ Cliente encontrado: ${client_id}`);
    console.log(`   Ad Account: ${ad_account_id} (${account_name})\n`);
    
    // Buscar connection_id
    const { data: conn, error: connIdError } = await supabase
      .from('client_meta_connections')
      .select('id')
      .eq('client_id', client_id)
      .eq('ad_account_id', ad_account_id)
      .single();
    
    if (connIdError) throw connIdError;
    const connection_id = conn.id;
    console.log(`   Connection ID: ${connection_id}\n`);
    
    // 2. Buscar campanhas
    console.log('2️⃣ Buscando campanhas...');
    const { data: campaigns, error: campError } = await supabase
      .from('meta_campaigns')
      .select('*')
      .eq('connection_id', connection_id)
      .limit(5);
    
    if (campError) throw campError;
    
    if (!campaigns || campaigns.length === 0) {
      console.log('⚠️  Nenhuma campanha encontrada!');
      console.log('💡 Sincronize as campanhas primeiro.');
      return;
    }
    
    console.log(`✅ ${campaigns.length} campanhas encontradas:`);
    campaigns.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.name} (${c.campaign_id}) - Status: ${c.status}`);
    });
    console.log('');
    
    // 3. Testar cada campanha
    for (const campaign of campaigns.slice(0, 2)) { // Testar apenas 2 primeiras
      console.log(`\n📊 Testando campanha: ${campaign.name}`);
      console.log(`   Campaign ID: ${campaign.campaign_id}\n`);
      
      // 3.1. Buscar adsets
      console.log('   🔍 Buscando conjuntos de anúncios (adsets)...');
      const { data: adsets, error: adsetsError } = await supabase
        .from('meta_adsets')
        .select('*')
        .eq('connection_id', connection_id)
        .eq('campaign_id', campaign.id);
      
      if (adsetsError) {
        console.log(`   ❌ Erro ao buscar adsets: ${adsetsError.message}`);
        continue;
      }
      
      if (!adsets || adsets.length === 0) {
        console.log('   ⚠️  Nenhum conjunto de anúncios encontrado!');
        console.log('   💡 Possíveis causas:');
        console.log('      - Campanha sem adsets criados no Meta');
        console.log('      - Dados não sincronizados');
        console.log('      - Filtro de data muito restrito');
        continue;
      }
      
      console.log(`   ✅ ${adsets.length} conjuntos encontrados:`);
      adsets.forEach((a, i) => {
        console.log(`      ${i + 1}. ${a.name} (${a.adset_id}) - Status: ${a.status}`);
      });
      
      // 3.2. Buscar ads do primeiro adset
      const firstAdset = adsets[0];
      console.log(`\n   🔍 Buscando anúncios do conjunto: ${firstAdset.name}...`);
      
      const { data: ads, error: adsError } = await supabase
        .from('meta_ads')
        .select('*')
        .eq('connection_id', connection_id)
        .eq('adset_id', firstAdset.id);
      
      if (adsError) {
        console.log(`   ❌ Erro ao buscar ads: ${adsError.message}`);
        continue;
      }
      
      if (!ads || ads.length === 0) {
        console.log('   ⚠️  Nenhum anúncio encontrado!');
        console.log('   💡 Possíveis causas:');
        console.log('      - Conjunto sem anúncios criados no Meta');
        console.log('      - Dados não sincronizados');
        continue;
      }
      
      console.log(`   ✅ ${ads.length} anúncios encontrados:`);
      ads.forEach((a, i) => {
        console.log(`      ${i + 1}. ${a.name} (${a.ad_id}) - Status: ${a.status}`);
      });
    }
    
    console.log('\n\n✅ TESTE CONCLUÍDO!');
    console.log('\n📋 RESUMO:');
    console.log(`   Cliente: ${client_id}`);
    console.log(`   Ad Account: ${ad_account_id}`);
    console.log(`   Campanhas: ${campaigns.length}`);
    console.log('\n💡 Se não apareceram adsets/ads:');
    console.log('   1. Verifique se existem no Meta Ads Manager');
    console.log('   2. Sincronize os dados novamente');
    console.log('   3. Verifique o período de data selecionado');
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testMetaHierarchy().then(() => {
  console.log('\n🏁 Teste finalizado!');
  process.exit(0);
}).catch(err => {
  console.error('💥 Erro fatal:', err);
  process.exit(1);
});
