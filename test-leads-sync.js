require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'OK' : 'MISSING');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'OK' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLeadsSync() {
  console.log('🔍 Testando sincronização de leads...\n');

  try {
    // 1. Buscar um cliente com conexão Meta ativa
    console.log('1️⃣ Buscando cliente com conexão Meta...');
    const { data: connections, error: connError } = await supabase
      .from('client_meta_connections')
      .select('*, clients(id, name)')
      .eq('is_active', true)
      .limit(1);

    if (connError) {
      console.error('❌ Erro ao buscar conexões:', connError);
      return;
    }

    if (!connections || connections.length === 0) {
      console.log('⚠️ Nenhuma conexão Meta ativa encontrada');
      return;
    }

    const connection = connections[0];
    console.log('✅ Conexão encontrada:', {
      clientId: connection.client_id,
      clientName: connection.clients?.name,
      adAccountId: connection.ad_account_id,
      accountName: connection.account_name
    });

    // 2. Testar chamada à API de sincronização
    console.log('\n2️⃣ Testando API de sincronização...');
    
    // Simular autenticação (você precisa de um token válido)
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      console.log('⚠️ Não há sessão ativa. Testando sem autenticação...');
    }

    const response = await fetch('http://localhost:3001/api/meta/leads/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify({
        clientId: connection.client_id
      })
    });

    console.log('Status da resposta:', response.status);
    
    const text = await response.text();
    console.log('Resposta bruta:', text);

    let data;
    try {
      data = text ? JSON.parse(text) : {};
      console.log('\n📊 Resposta JSON:', JSON.stringify(data, null, 2));
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse da resposta:', parseError);
      console.log('Texto recebido:', text);
    }

    // 3. Verificar tabelas de leads
    console.log('\n3️⃣ Verificando tabelas de leads...');
    
    const { data: forms, error: formsError } = await supabase
      .from('meta_lead_forms')
      .select('*')
      .eq('connection_id', connection.id);

    console.log('Formulários encontrados:', forms?.length || 0);
    if (forms && forms.length > 0) {
      console.log('Formulários:', forms.map(f => ({ id: f.external_id, name: f.name })));
    }

    const { data: leads, error: leadsError } = await supabase
      .from('meta_leads')
      .select('*')
      .eq('connection_id', connection.id);

    console.log('Leads encontrados:', leads?.length || 0);

    const { data: logs, error: logsError } = await supabase
      .from('meta_lead_sync_logs')
      .select('*')
      .eq('connection_id', connection.id)
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('\n📝 Últimos logs de sincronização:');
    if (logs && logs.length > 0) {
      logs.forEach(log => {
        console.log(`  - ${log.created_at}: ${log.success ? '✅' : '❌'} ${log.leads_synced} leads`);
        if (log.error_message) {
          console.log(`    Erro: ${log.error_message}`);
        }
      });
    } else {
      console.log('  Nenhum log encontrado');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testLeadsSync();
