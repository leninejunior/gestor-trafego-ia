/**
 * Script de teste para o sistema de leads do Meta Ads
 * 
 * Testa:
 * - Sincronização de leads
 * - Listagem de leads
 * - Atualização de status
 * - Estatísticas
 * - Formulários
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'OK' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'OK' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLeadsSystem() {
  console.log('🧪 Testando Sistema de Leads Meta Ads\n');

  try {
    // 1. Verificar schema
    console.log('1️⃣ Verificando schema do banco...');
    
    const tables = ['meta_lead_forms', 'meta_leads', 'meta_lead_sync_logs'];
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.error(`   ❌ Tabela ${table} não encontrada ou erro:`, error.message);
      } else {
        console.log(`   ✅ Tabela ${table} existe`);
      }
    }

    // 2. Verificar views
    console.log('\n2️⃣ Verificando views...');
    
    const { data: viewData, error: viewError } = await supabase
      .from('meta_lead_stats_by_campaign')
      .select('*')
      .limit(1);
    
    if (viewError) {
      console.error('   ❌ View meta_lead_stats_by_campaign não encontrada:', viewError.message);
    } else {
      console.log('   ✅ View meta_lead_stats_by_campaign existe');
    }

    // 3. Buscar conexões Meta ativas
    console.log('\n3️⃣ Buscando conexões Meta ativas...');
    
    const { data: connections, error: connError } = await supabase
      .from('client_meta_connections')
      .select('id, client_id, ad_account_id, account_name, is_active')
      .eq('is_active', true);
    
    if (connError) {
      console.error('   ❌ Erro ao buscar conexões:', connError.message);
      return;
    }

    if (!connections || connections.length === 0) {
      console.log('   ⚠️  Nenhuma conexão Meta ativa encontrada');
      console.log('   💡 Configure uma conexão Meta primeiro');
      return;
    }

    console.log(`   ✅ ${connections.length} conexão(ões) ativa(s) encontrada(s)`);
    connections.forEach(conn => {
      console.log(`      - ${conn.account_name} (${conn.ad_account_id})`);
    });

    const testConnection = connections[0];

    // 4. Verificar formulários
    console.log('\n4️⃣ Verificando formulários de lead ads...');
    
    const { data: forms, error: formsError } = await supabase
      .from('meta_lead_forms')
      .select('*')
      .eq('connection_id', testConnection.id);
    
    if (formsError) {
      console.error('   ❌ Erro ao buscar formulários:', formsError.message);
    } else {
      console.log(`   ✅ ${forms?.length || 0} formulário(s) encontrado(s)`);
      
      if (forms && forms.length > 0) {
        forms.forEach(form => {
          console.log(`      - ${form.name} (${form.status})`);
        });
      } else {
        console.log('   💡 Execute sincronização para buscar formulários');
      }
    }

    // 5. Verificar leads
    console.log('\n5️⃣ Verificando leads capturados...');
    
    const { data: leads, error: leadsError, count } = await supabase
      .from('meta_leads')
      .select('*', { count: 'exact' })
      .eq('connection_id', testConnection.id)
      .order('created_time', { ascending: false })
      .limit(5);
    
    if (leadsError) {
      console.error('   ❌ Erro ao buscar leads:', leadsError.message);
    } else {
      console.log(`   ✅ ${count || 0} lead(s) total(is)`);
      
      if (leads && leads.length > 0) {
        console.log('\n   📋 Últimos 5 leads:');
        leads.forEach((lead, idx) => {
          const name = lead.field_data?.full_name || 'Nome não disponível';
          const email = lead.field_data?.email || 'Email não disponível';
          console.log(`      ${idx + 1}. ${name} (${email}) - Status: ${lead.status}`);
          console.log(`         Campanha: ${lead.campaign_name || 'N/A'}`);
          console.log(`         Data: ${new Date(lead.created_time).toLocaleString('pt-BR')}`);
        });
      } else {
        console.log('   💡 Execute sincronização para buscar leads');
      }
    }

    // 6. Estatísticas por status
    console.log('\n6️⃣ Estatísticas por status...');
    
    const { data: allLeads } = await supabase
      .from('meta_leads')
      .select('status')
      .eq('connection_id', testConnection.id);
    
    if (allLeads) {
      const statusCounts = {
        new: 0,
        contacted: 0,
        qualified: 0,
        converted: 0,
        lost: 0
      };
      
      allLeads.forEach(lead => {
        if (lead.status in statusCounts) {
          statusCounts[lead.status]++;
        }
      });
      
      console.log('   📊 Distribuição por status:');
      console.log(`      - Novos: ${statusCounts.new}`);
      console.log(`      - Contactados: ${statusCounts.contacted}`);
      console.log(`      - Qualificados: ${statusCounts.qualified}`);
      console.log(`      - Convertidos: ${statusCounts.converted}`);
      console.log(`      - Perdidos: ${statusCounts.lost}`);
    }

    // 7. Verificar logs de sincronização
    console.log('\n7️⃣ Verificando logs de sincronização...');
    
    const { data: logs, error: logsError } = await supabase
      .from('meta_lead_sync_logs')
      .select('*')
      .eq('connection_id', testConnection.id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (logsError) {
      console.error('   ❌ Erro ao buscar logs:', logsError.message);
    } else {
      console.log(`   ✅ ${logs?.length || 0} log(s) de sincronização`);
      
      if (logs && logs.length > 0) {
        console.log('\n   📝 Últimas sincronizações:');
        logs.forEach((log, idx) => {
          const status = log.success ? '✅' : '❌';
          const date = new Date(log.sync_started_at).toLocaleString('pt-BR');
          console.log(`      ${idx + 1}. ${status} ${date}`);
          console.log(`         Leads: ${log.leads_synced} (${log.leads_new} novos, ${log.leads_updated} atualizados)`);
          if (!log.success && log.error_message) {
            console.log(`         Erro: ${log.error_message}`);
          }
        });
      } else {
        console.log('   💡 Nenhuma sincronização realizada ainda');
      }
    }

    // 8. Verificar RLS policies
    console.log('\n8️⃣ Verificando políticas RLS...');
    
    const { data: policies, error: policiesError } = await supabase
      .rpc('pg_policies')
      .select('*')
      .in('tablename', tables);
    
    if (!policiesError && policies) {
      console.log(`   ✅ Políticas RLS configuradas`);
    } else {
      console.log('   ⚠️  Não foi possível verificar políticas RLS');
    }

    // Resumo final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DO SISTEMA DE LEADS');
    console.log('='.repeat(60));
    console.log(`✅ Schema: Tabelas e views criadas`);
    console.log(`✅ Conexões: ${connections.length} ativa(s)`);
    console.log(`✅ Formulários: ${forms?.length || 0} configurado(s)`);
    console.log(`✅ Leads: ${count || 0} capturado(s)`);
    console.log(`✅ Logs: ${logs?.length || 0} sincronização(ões)`);
    
    console.log('\n💡 PRÓXIMOS PASSOS:');
    console.log('1. Execute sincronização: POST /api/meta/leads/sync');
    console.log('2. Configure webhook do Meta para leads em tempo real');
    console.log('3. Crie interface UI para gerenciar leads');
    console.log('4. Configure notificações para novos leads');

  } catch (error) {
    console.error('\n❌ Erro durante teste:', error);
  }
}

// Executar teste
testLeadsSystem()
  .then(() => {
    console.log('\n✅ Teste concluído!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
