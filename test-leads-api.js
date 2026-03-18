// Script para testar a API de leads e clientes acessíveis
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  console.log('URL:', supabaseUrl);
  console.log('Key:', supabaseServiceKey ? 'presente' : 'ausente');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAccessibleClients() {
  console.log('\n🔍 Testando busca de clientes...\n');

  // 1. Buscar todos os clientes
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, org_id')
    .order('name');

  if (clientsError) {
    console.error('❌ Erro ao buscar clientes:', clientsError);
    return;
  }

  console.log(`✅ Total de clientes: ${clients.length}`);
  clients.forEach(c => console.log(`   - ${c.name} (${c.id})`));

  // 2. Buscar conexões Meta
  const clientIds = clients.map(c => c.id);
  const { data: metaConnections, error: metaError } = await supabase
    .from('client_meta_connections')
    .select('client_id, ad_account_id, account_name, is_active')
    .in('client_id', clientIds);

  if (metaError) {
    console.error('❌ Erro ao buscar conexões Meta:', metaError);
    return;
  }

  console.log(`\n✅ Conexões Meta encontradas: ${metaConnections?.length || 0}`);
  metaConnections?.forEach(c => {
    console.log(`   - Cliente: ${c.client_id}`);
    console.log(`     Conta: ${c.account_name} (${c.ad_account_id})`);
    console.log(`     Ativa: ${c.is_active}`);
  });

  // 3. Buscar usuários e memberships
  const { data: memberships, error: membershipError } = await supabase
    .from('memberships')
    .select('user_id, organization_id, role')
    .limit(10);

  if (membershipError) {
    console.error('❌ Erro ao buscar memberships:', membershipError);
    return;
  }

  console.log(`\n✅ Memberships encontradas: ${memberships?.length || 0}`);
  memberships?.forEach(m => {
    console.log(`   - User: ${m.user_id}, Org: ${m.organization_id}, Role: ${m.role}`);
  });

  // 4. Buscar super admins
  const { data: superAdmins, error: superAdminError } = await supabase
    .from('super_admins')
    .select('user_id, is_active')
    .eq('is_active', true);

  if (superAdminError) {
    console.error('❌ Erro ao buscar super admins:', superAdminError);
    return;
  }

  console.log(`\n✅ Super admins ativos: ${superAdmins?.length || 0}`);
  superAdmins?.forEach(sa => {
    console.log(`   - User: ${sa.user_id}`);
  });

  // 5. Verificar tabela de leads
  const { data: leads, error: leadsError } = await supabase
    .from('meta_leads')
    .select('id, external_id, status')
    .limit(5);

  if (leadsError) {
    console.error('❌ Erro ao buscar leads:', leadsError);
    console.log('   (Tabela pode não existir ainda)');
  } else {
    console.log(`\n✅ Leads encontrados: ${leads?.length || 0}`);
  }

  console.log('\n✅ Teste concluído!');
}

testAccessibleClients().catch(console.error);
