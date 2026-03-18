/**
 * Script para diagnosticar problemas de sincronização do Google Ads
 * 
 * Uso: node scripts/diagnosticar-google-sync.js <client-name>
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosticar(clientName) {
  console.log('\n🔍 DIAGNÓSTICO DE SINCRONIZAÇÃO GOOGLE ADS');
  console.log('==========================================\n');

  try {
    // 1. Buscar cliente
    console.log(`📋 Buscando cliente: "${clientName}"...`);
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, org_id')
      .ilike('name', `%${clientName}%`);

    if (clientError) {
      console.error('❌ Erro ao buscar cliente:', clientError);
      return;
    }

    if (!clients || clients.length === 0) {
      console.error(`❌ Cliente "${clientName}" não encontrado`);
      return;
    }

    const client = clients[0];
    console.log(`✅ Cliente encontrado: ${client.name} (${client.id})\n`);

    // 2. Verificar conexões
    console.log('🔗 Verificando conexões Google Ads...');
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('client_id', client.id);

    if (connError) {
      console.error('❌ Erro ao buscar conexões:', connError);
      return;
    }

    if (!connections || connections.length === 0) {
      console.error('❌ Nenhuma conexão Google Ads encontrada para este cliente');
      return;
    }

    console.log(`✅ ${connections.length} conexão(ões) encontrada(s):`);
    connections.forEach((conn, i) => {
      console.log(`   ${i + 1}. Customer ID: ${conn.customer_id}`);
      console.log(`      Status: ${conn.status}`);
      console.log(`      Última sync: ${conn.last_sync_at || 'Nunca'}`);
      console.log(`      Token expira em: ${conn.token_expires_at || 'N/A'}`);
    });
    console.log('');

    // 3. Verificar campanhas
    console.log('📊 Verificando campanhas sincronizadas...');
    const { data: campaigns, error: campError } = await supabase
      .from('google_campaigns')
      .select('*')
      .eq('client_id', client.id);

    if (campError) {
      console.error('❌ Erro ao buscar campanhas:', campError);
    } else if (!campaigns || campaigns.length === 0) {
      console.error('❌ Nenhuma campanha sincronizada encontrada');
    } else {
      console.log(`✅ ${campaigns.length} campanha(s) sincronizada(s):`);
      campaigns.forEach((camp, i) => {
        console.log(`   ${i + 1}. ${camp.campaign_name} (ID: ${camp.campaign_id})`);
        console.log(`      Status: ${camp.status}`);
        console.log(`      Orçamento: ${camp.budget_amount} ${camp.budget_currency}`);
      });
    }
    console.log('');

    // 4. Verificar logs de sincronização
    console.log('📝 Verificando logs de sincronização...');
    const { data: logs, error: logsError } = await supabase
      .from('google_ads_sync_logs')
      .select(`
        *,
        google_ads_connections!inner(client_id, customer_id)
      `)
      .eq('google_ads_connections.client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (logsError) {
      console.error('❌ Erro ao buscar logs:', logsError);
    } else if (!logs || logs.length === 0) {
      console.error('❌ Nenhum log de sincronização encontrado');
    } else {
      console.log(`✅ ${logs.length} log(s) recente(s):`);
      logs.forEach((log, i) => {
        console.log(`   ${i + 1}. ${log.sync_type} - ${log.status}`);
        console.log(`      Data: ${log.created_at}`);
        console.log(`      Campanhas: ${log.campaigns_synced}`);
        console.log(`      Métricas: ${log.metrics_updated}`);
        if (log.error_message) {
          console.log(`      ⚠️  Erro: ${log.error_message}`);
        }
      });
    }
    console.log('');

    // 5. Diagnóstico final
    console.log('🎯 DIAGNÓSTICO:');
    console.log('================');
    
    const hasConnection = connections && connections.length > 0;
    const hasActiveConnection = connections?.some(c => c.status === 'active');
    const hasCampaigns = campaigns && campaigns.length > 0;
    const lastLog = logs?.[0];

    if (!hasConnection) {
      console.log('❌ Problema: Nenhuma conexão Google Ads configurada');
      console.log('   Solução: Conecte uma conta Google Ads primeiro');
    } else if (!hasActiveConnection) {
      console.log('❌ Problema: Conexão existe mas não está ativa');
      console.log('   Solução: Reconecte a conta Google Ads');
    } else if (!hasCampaigns && lastLog?.status === 'failed') {
      console.log('❌ Problema: Sincronização falhou');
      console.log(`   Erro: ${lastLog.error_message}`);
      console.log('   Solução: Verifique as credenciais e permissões da API');
    } else if (!hasCampaigns && !lastLog) {
      console.log('⚠️  Problema: Conexão ativa mas nunca sincronizou');
      console.log('   Solução: Execute uma sincronização manual');
    } else if (!hasCampaigns) {
      console.log('⚠️  Problema: Sincronização executou mas não encontrou campanhas');
      console.log('   Possíveis causas:');
      console.log('   - Conta Google Ads não tem campanhas ativas');
      console.log('   - Customer ID incorreto');
      console.log('   - Permissões insuficientes na API');
    } else {
      console.log('✅ Tudo parece estar funcionando corretamente!');
    }

  } catch (error) {
    console.error('\n❌ Erro durante diagnóstico:', error);
  }
}

// Executar
const clientName = process.argv[2];

if (!clientName) {
  console.error('❌ Uso: node scripts/diagnosticar-google-sync.js <nome-do-cliente>');
  console.error('   Exemplo: node scripts/diagnosticar-google-sync.js "Dr Hernia"');
  process.exit(1);
}

diagnosticar(clientName);
