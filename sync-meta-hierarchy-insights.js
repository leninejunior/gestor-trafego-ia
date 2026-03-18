/**
 * Sincronizar métricas (insights) da hierarquia completa Meta Ads
 * Campanhas → Adsets → Ads
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

// Últimos 30 dias
const dateEnd = new Date();
const dateStart = new Date();
dateStart.setDate(dateStart.getDate() - 30);

const dateStartStr = dateStart.toISOString().split('T')[0];
const dateEndStr = dateEnd.toISOString().split('T')[0];

function fetchFromMeta(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${body}`));
        }
      });
    }).on('error', reject);
  });
}

async function syncHierarchyInsights() {
  console.log('🔄 SINCRONIZANDO MÉTRICAS DA HIERARQUIA META ADS');
  console.log(`📅 Período: ${dateStartStr} até ${dateEndStr}\n`);
  
  try {
    // 1. Buscar conexão ativa
    const { data: connection, error: connError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();
    
    if (connError) throw connError;
    
    console.log(`✅ Conexão: ${connection.account_name}`);
    console.log(`   Ad Account: ${connection.ad_account_id}\n`);
    
    // 2. Buscar campanhas do banco
    const { data: campaigns, error: campError } = await supabase
      .from('meta_campaigns')
      .select('id, external_id, name')
      .eq('connection_id', connection.id);
    
    if (campError) throw campError;
    
    console.log(`📊 ${campaigns.length} campanhas encontradas\n`);
    
    let totalAdsets = 0;
    let totalAds = 0;
    
    // 3. Para cada campanha, buscar adsets e suas métricas
    for (const campaign of campaigns) {
      console.log(`\n🎯 Campanha: ${campaign.name}`);
      
      // 3.1. Buscar adsets desta campanha
      const { data: adsets, error: adsetsError } = await supabase
        .from('meta_adsets')
        .select('id, external_id, name')
        .eq('campaign_id', campaign.id);
      
      if (adsetsError) {
        console.log(`   ⚠️  Erro ao buscar adsets: ${adsetsError.message}`);
        continue;
      }
      
      console.log(`   📦 ${adsets.length} conjuntos de anúncios`);
      totalAdsets += adsets.length;
      
      // 3.2. Buscar métricas de cada adset
      for (const adset of adsets) {
        const insightsUrl = `https://graph.facebook.com/v22.0/${adset.external_id}/insights?fields=impressions,clicks,spend,reach,frequency,cpm,cpc,ctr,actions,cost_per_action_type&time_range={"since":"${dateStartStr}","until":"${dateEndStr}"}&access_token=${connection.access_token}`;
        
        try {
          const insightsData = await fetchFromMeta(insightsUrl);
          
          if (insightsData.error) {
            console.log(`      ⚠️  ${adset.name}: ${insightsData.error.message}`);
            continue;
          }
          
          const insights = insightsData.data || [];
          
          if (insights.length === 0) {
            console.log(`      ℹ️  ${adset.name}: Sem dados no período`);
            continue;
          }
          
          const insight = insights[0];
          
          // Extrair conversões
          let conversions = 0;
          let costPerConversion = null;
          
          if (insight.actions) {
            const conversionAction = insight.actions.find(a => 
              a.action_type === 'offsite_conversion.fb_pixel_purchase' ||
              a.action_type === 'omni_purchase'
            );
            if (conversionAction) {
              conversions = parseInt(conversionAction.value) || 0;
            }
          }
          
          if (insight.cost_per_action_type && conversions > 0) {
            const costAction = insight.cost_per_action_type.find(c =>
              c.action_type === 'offsite_conversion.fb_pixel_purchase' ||
              c.action_type === 'omni_purchase'
            );
            if (costAction) {
              costPerConversion = parseFloat(costAction.value) || null;
            }
          }
          
          // Salvar métricas do adset
          const adsetInsight = {
            adset_id: adset.id,
            date_start: dateStartStr,
            date_stop: dateEndStr,
            impressions: parseInt(insight.impressions) || 0,
            clicks: parseInt(insight.clicks) || 0,
            spend: parseFloat(insight.spend) || 0,
            reach: parseInt(insight.reach) || 0,
            frequency: parseFloat(insight.frequency) || 0,
            cpm: parseFloat(insight.cpm) || 0,
            cpc: parseFloat(insight.cpc) || 0,
            ctr: parseFloat(insight.ctr) || 0,
            conversions,
            cost_per_conversion: costPerConversion,
            updated_at: new Date().toISOString()
          };
          
          const { error: insightError } = await supabase
            .from('meta_adset_insights')
            .upsert(adsetInsight, {
              onConflict: 'adset_id,date_start,date_stop',
              ignoreDuplicates: false
            });
          
          if (insightError) {
            console.log(`      ❌ ${adset.name}: ${insightError.message}`);
          } else {
            console.log(`      ✅ ${adset.name}: ${insight.impressions} imp, R$ ${parseFloat(insight.spend).toFixed(2)}`);
          }
          
        } catch (error) {
          console.log(`      ❌ ${adset.name}: ${error.message}`);
        }
        
        // 3.3. Buscar ads deste adset
        const { data: ads, error: adsError } = await supabase
          .from('meta_ads')
          .select('id, external_id, name')
          .eq('adset_id', adset.id);
        
        if (adsError) {
          console.log(`      ⚠️  Erro ao buscar ads: ${adsError.message}`);
          continue;
        }
        
        totalAds += ads.length;
        
        // 3.4. Buscar métricas de cada ad
        for (const ad of ads) {
          const adInsightsUrl = `https://graph.facebook.com/v22.0/${ad.external_id}/insights?fields=impressions,clicks,spend,reach,frequency,cpm,cpc,ctr,actions,cost_per_action_type&time_range={"since":"${dateStartStr}","until":"${dateEndStr}"}&access_token=${connection.access_token}`;
          
          try {
            const adInsightsData = await fetchFromMeta(adInsightsUrl);
            
            if (adInsightsData.error) {
              console.log(`         ⚠️  ${ad.name}: ${adInsightsData.error.message}`);
              continue;
            }
            
            const adInsights = adInsightsData.data || [];
            
            if (adInsights.length === 0) {
              console.log(`         ℹ️  ${ad.name}: Sem dados no período`);
              continue;
            }
            
            const adInsight = adInsights[0];
            
            // Extrair conversões
            let adConversions = 0;
            let adCostPerConversion = null;
            
            if (adInsight.actions) {
              const conversionAction = adInsight.actions.find(a => 
                a.action_type === 'offsite_conversion.fb_pixel_purchase' ||
                a.action_type === 'omni_purchase'
              );
              if (conversionAction) {
                adConversions = parseInt(conversionAction.value) || 0;
              }
            }
            
            if (adInsight.cost_per_action_type && adConversions > 0) {
              const costAction = adInsight.cost_per_action_type.find(c =>
                c.action_type === 'offsite_conversion.fb_pixel_purchase' ||
                c.action_type === 'omni_purchase'
              );
              if (costAction) {
                adCostPerConversion = parseFloat(costAction.value) || null;
              }
            }
            
            // Salvar métricas do ad
            const adInsightData = {
              ad_id: ad.id,
              date_start: dateStartStr,
              date_stop: dateEndStr,
              impressions: parseInt(adInsight.impressions) || 0,
              clicks: parseInt(adInsight.clicks) || 0,
              spend: parseFloat(adInsight.spend) || 0,
              reach: parseInt(adInsight.reach) || 0,
              frequency: parseFloat(adInsight.frequency) || 0,
              cpm: parseFloat(adInsight.cpm) || 0,
              cpc: parseFloat(adInsight.cpc) || 0,
              ctr: parseFloat(adInsight.ctr) || 0,
              conversions: adConversions,
              cost_per_conversion: adCostPerConversion,
              updated_at: new Date().toISOString()
            };
            
            const { error: adInsightError } = await supabase
              .from('meta_ad_insights')
              .upsert(adInsightData, {
                onConflict: 'ad_id,date_start,date_stop',
                ignoreDuplicates: false
              });
            
            if (adInsightError) {
              console.log(`         ❌ ${ad.name}: ${adInsightError.message}`);
            } else {
              console.log(`         ✅ ${ad.name}: ${adInsight.impressions} imp, R$ ${parseFloat(adInsight.spend).toFixed(2)}`);
            }
            
          } catch (error) {
            console.log(`         ❌ ${ad.name}: ${error.message}`);
          }
        }
      }
    }
    
    console.log('\n\n🎉 SINCRONIZAÇÃO COMPLETA!');
    console.log(`\n📊 Resumo:`);
    console.log(`   Campanhas: ${campaigns.length}`);
    console.log(`   Conjuntos de anúncios: ${totalAdsets}`);
    console.log(`   Anúncios: ${totalAds}`);
    console.log(`\n💡 Agora atualize a página de campanhas para ver as métricas!`);
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error('Stack:', error.stack);
  }
}

syncHierarchyInsights().then(() => process.exit(0));
