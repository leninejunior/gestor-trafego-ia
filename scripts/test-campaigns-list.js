/**
 * Script de teste para API de listagem de campanhas Google Ads
 * 
 * Uso: node scripts/test-campaigns-list.js [clientId]
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCampaignsList(clientId) {
  console.log('🧪 Testando listagem de campanhas Google Ads\n');
  console.log('📋 Client ID:', clientId || 'Todos os clientes');
  console.log('─'.repeat(60));

  try {
    // 1. Buscar campanhas
    console.log('\n1️⃣ Buscando campanhas do banco...');
    let query = supabase
      .from('google_ads_campaigns')
      .select(`
        *,
        connection:google_ads_connections(customer_id)
      `)
      .order('created_at', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data: campaigns, error } = await query;

    if (error) {
      console.error('❌ Erro ao buscar campanhas:', error.message);
      return;
    }

    console.log(`✅ ${campaigns.length} campanha(s) encontrada(s)`);

    // 2. Exibir campanhas
    if (campaigns.length > 0) {
      console.log('\n📊 Campanhas:');
      console.log('─'.repeat(60));
      
      campaigns.forEach((campaign, index) => {
        console.log(`\n${index + 1}. ${campaign.name}`);
        console.log(`   ID: ${campaign.campaign_id}`);
        console.log(`   Status: ${campaign.status}`);
        console.log(`   Orçamento: ${formatBudget(campaign.budget_amount_micros)}`);
        console.log(`   Conta: ${campaign.connection?.customer_id || 'N/A'}`);
        console.log(`   Sincronizada: ${new Date(campaign.created_at).toLocaleString('pt-BR')}`);
      });
    } else {
      console.log('\n📭 Nenhuma campanha encontrada');
      console.log('\n💡 Dicas:');
      console.log('   - Verifique se há conexões Google Ads ativas');
      console.log('   - Execute a sincronização de campanhas');
      console.log('   - Verifique os logs de sincronização');
    }

    // 3. Estatísticas
    console.log('\n📈 Estatísticas:');
    console.log('─'.repeat(60));
    
    const statusCount = campaigns.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {});

    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    // 4. Verificar conexões
    console.log('\n🔗 Verificando conexões...');
    const { data: connections } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('is_active', true);

    console.log(`   ${connections?.length || 0} conexão(ões) ativa(s)`);

    if (connections && connections.length > 0) {
      connections.forEach((conn, index) => {
        console.log(`   ${index + 1}. Customer ID: ${conn.customer_id}`);
      });
    }

  } catch (error) {
    console.error('💥 Erro:', error.message);
  }
}

function formatBudget(budgetMicros) {
  if (!budgetMicros) return 'N/A';
  const value = budgetMicros / 1000000;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// Executar
const clientId = process.argv[2];
testCampaignsList(clientId);
