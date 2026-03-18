/**
 * Sincronizar campanhas do Meta Ads
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variáveis ausentes: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_KEY).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncCampaigns() {
  console.log('🔄 SINCRONIZANDO CAMPANHAS META ADS\n');
  
  try {
    // 1. Buscar primeira conexão ativa
    const { data: connection, error: connError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();
    
    if (connError) throw connError;
    
    console.log(`✅ Conexão: ${connection.account_name}`);
    console.log(`   Ad Account: ${connection.ad_account_id}`);
    console.log(`   Client ID: ${connection.client_id}\n`);
    
    // 2. Buscar campanhas da API do Meta
    console.log('📡 Buscando campanhas da API Meta...');
    const url = `https://graph.facebook.com/v22.0/${connection.ad_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time,start_time,stop_time&access_token=${connection.access_token}`;
    
    const data = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(JSON.parse(body)));
      }).on('error', reject);
    });
    
    if (data.error) {
      console.error('❌ Erro da API Meta:', data.error.message);
      if (data.error.code === 190) {
        console.log('\n💡 Token expirado! Reconecte a conta Meta.');
      }
      return;
    }
    
    const campaigns = data.data || [];
    console.log(`✅ ${campaigns.length} campanhas encontradas na API\n`);
    
    if (campaigns.length === 0) {
      console.log('⚠️  Nenhuma campanha encontrada nesta conta.');
      return;
    }
    
    // 3. Inserir campanhas no banco
    console.log('💾 Salvando campanhas no banco...');
    let inserted = 0;
    let updated = 0;
    
    for (const camp of campaigns) {
      const campaignData = {
        connection_id: connection.id,
        external_id: camp.id,
        name: camp.name,
        status: camp.status,
        objective: camp.objective || null,
        daily_budget: camp.daily_budget ? parseFloat(camp.daily_budget) / 100 : null,
        lifetime_budget: camp.lifetime_budget ? parseFloat(camp.lifetime_budget) / 100 : null,
        created_time: camp.created_time || null,
        updated_time: camp.updated_time || null,
        start_time: camp.start_time || null,
        stop_time: camp.stop_time || null,
        updated_at: new Date().toISOString()
      };
      
      // Tentar inserir ou atualizar
      const { error: upsertError } = await supabase
        .from('meta_campaigns')
        .upsert(campaignData, {
          onConflict: 'connection_id,external_id',
          ignoreDuplicates: false
        });
      
      if (upsertError) {
        console.log(`   ⚠️  Erro ao salvar ${camp.name}: ${upsertError.message}`);
      } else {
        inserted++;
        console.log(`   ✅ ${camp.name} (${camp.status})`);
      }
    }
    
    console.log(`\n✅ Sincronização concluída!`);
    console.log(`   Campanhas processadas: ${inserted}/${campaigns.length}`);
    
    // 4. Agora buscar adsets da primeira campanha
    console.log('\n🔄 Sincronizando conjuntos de anúncios...');
    const firstCampaign = campaigns[0];
    
    const adsetsUrl = `https://graph.facebook.com/v22.0/${firstCampaign.id}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,optimization_goal,billing_event,created_time,updated_time,start_time,end_time&access_token=${connection.access_token}`;
    
    const adsetsData = await new Promise((resolve, reject) => {
      https.get(adsetsUrl, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(JSON.parse(body)));
      }).on('error', reject);
    });
    
    if (adsetsData.error) {
      console.error('❌ Erro ao buscar adsets:', adsetsData.error.message);
      return;
    }
    
    const adsets = adsetsData.data || [];
    console.log(`✅ ${adsets.length} conjuntos encontrados\n`);
    
    // Buscar o ID interno da campanha
    const { data: dbCampaign } = await supabase
      .from('meta_campaigns')
      .select('id')
      .eq('connection_id', connection.id)
      .eq('external_id', firstCampaign.id)
      .single();
    
    if (!dbCampaign) {
      console.log('⚠️  Campanha não encontrada no banco');
      return;
    }
    
    // Inserir adsets
    for (const adset of adsets) {
      const adsetData = {
        connection_id: connection.id,
        campaign_id: dbCampaign.id,
        external_id: adset.id,
        name: adset.name,
        status: adset.status,
        daily_budget: adset.daily_budget ? parseFloat(adset.daily_budget) / 100 : null,
        lifetime_budget: adset.lifetime_budget ? parseFloat(adset.lifetime_budget) / 100 : null,
        optimization_goal: adset.optimization_goal || null,
        billing_event: adset.billing_event || null,
        created_time: adset.created_time || null,
        updated_time: adset.updated_time || null,
        start_time: adset.start_time || null,
        end_time: adset.end_time || null,
        updated_at: new Date().toISOString()
      };
      
      const { error: adsetError } = await supabase
        .from('meta_adsets')
        .upsert(adsetData, {
          onConflict: 'connection_id,external_id',
          ignoreDuplicates: false
        });
      
      if (adsetError) {
        console.log(`   ⚠️  Erro ao salvar ${adset.name}: ${adsetError.message}`);
      } else {
        console.log(`   ✅ ${adset.name} (${adset.status})`);
      }
    }
    
    // 5. Buscar ads do primeiro adset
    if (adsets.length > 0) {
      console.log('\n🔄 Sincronizando anúncios...');
      const firstAdset = adsets[0];
      
      const adsUrl = `https://graph.facebook.com/v22.0/${firstAdset.id}/ads?fields=id,name,status,adset_id,creative{id,name}&access_token=${connection.access_token}`;
      
      const adsData = await new Promise((resolve, reject) => {
        https.get(adsUrl, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });
      
      if (adsData.error) {
        console.error('❌ Erro ao buscar ads:', adsData.error.message);
        return;
      }
      
      const ads = adsData.data || [];
      console.log(`✅ ${ads.length} anúncios encontrados\n`);
      
      // Buscar o ID interno do adset
      const { data: dbAdset } = await supabase
        .from('meta_adsets')
        .select('id')
        .eq('connection_id', connection.id)
        .eq('external_id', firstAdset.id)
        .single();
      
      if (!dbAdset) {
        console.log('⚠️  Adset não encontrado no banco');
        return;
      }
      
      // Inserir ads
      for (const ad of ads) {
        const adData = {
          connection_id: connection.id,
          adset_id: dbAdset.id,
          external_id: ad.id,
          name: ad.name,
          status: ad.status,
          creative_id: ad.creative?.id || null,
          updated_at: new Date().toISOString()
        };
        
        const { error: adError } = await supabase
          .from('meta_ads')
          .upsert(adData, {
            onConflict: 'connection_id,external_id',
            ignoreDuplicates: false
          });
        
        if (adError) {
          console.log(`   ⚠️  Erro ao salvar ${ad.name}: ${adError.message}`);
        } else {
          console.log(`   ✅ ${ad.name} (${ad.status})`);
        }
      }
    }
    
    console.log('\n🎉 SINCRONIZAÇÃO COMPLETA!');
    console.log('\n📊 Execute novamente: node test-meta-real.js');
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error('Stack:', error.stack);
  }
}

syncCampaigns().then(() => process.exit(0));
