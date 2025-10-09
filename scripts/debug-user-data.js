// Script para debugar dados do usuário e estrutura do banco
// Execute: node scripts/debug-user-data.js

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUserData() {
  console.log('🔍 Debugando dados do usuário...\n');

  try {
    // 1. Verificar usuário autenticado
    console.log('1. Verificando usuário autenticado...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('❌ Usuário não autenticado');
      console.log('   Para testar, você precisa estar logado na aplicação');
      return;
    }

    console.log('✅ Usuário autenticado:', user.id);
    console.log('   Email:', user.email);

    // 2. Verificar memberships do usuário
    console.log('\n2. Verificando memberships...');
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', user.id);

    if (membershipError) {
      console.error('❌ Erro ao buscar memberships:', membershipError.message);
    } else {
      console.log(`✅ Encontrados ${memberships?.length || 0} memberships`);
      memberships?.forEach((m, i) => {
        console.log(`   ${i + 1}. Org: ${m.org_id}, Role: ${m.role}`);
      });
    }

    // 3. Verificar organizações
    console.log('\n3. Verificando organizações...');
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('*');

    if (orgError) {
      console.error('❌ Erro ao buscar organizações:', orgError.message);
    } else {
      console.log(`✅ Encontradas ${organizations?.length || 0} organizações`);
      organizations?.forEach((org, i) => {
        console.log(`   ${i + 1}. ${org.name} (${org.id})`);
      });
    }

    // 4. Verificar clientes
    console.log('\n4. Verificando clientes...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*');

    if (clientError) {
      console.error('❌ Erro ao buscar clientes:', clientError.message);
    } else {
      console.log(`✅ Encontrados ${clients?.length || 0} clientes`);
      clients?.forEach((client, i) => {
        console.log(`   ${i + 1}. ${client.name} (${client.id}) - Org: ${client.org_id}`);
      });
    }

    // 5. Verificar conexões Meta
    console.log('\n5. Verificando conexões Meta...');
    const { data: connections, error: connectionError } = await supabase
      .from('client_meta_connections')
      .select(`
        *,
        clients (
          id,
          name,
          org_id
        )
      `);

    if (connectionError) {
      console.error('❌ Erro ao buscar conexões:', connectionError.message);
    } else {
      console.log(`✅ Encontradas ${connections?.length || 0} conexões`);
      connections?.forEach((conn, i) => {
        console.log(`   ${i + 1}. ${conn.account_name} (${conn.id})`);
        console.log(`       Cliente: ${conn.clients?.name} (${conn.client_id})`);
        console.log(`       Org: ${conn.clients?.org_id}`);
      });
    }

    // 6. Verificar se usuário tem acesso às conexões
    if (memberships && memberships.length > 0 && connections && connections.length > 0) {
      console.log('\n6. Verificando acesso às conexões...');
      
      const userOrgIds = memberships.map(m => m.org_id);
      
      connections.forEach((conn, i) => {
        const hasAccess = userOrgIds.includes(conn.clients?.org_id);
        console.log(`   ${i + 1}. ${conn.account_name}: ${hasAccess ? '✅ TEM ACESSO' : '❌ SEM ACESSO'}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar debug
debugUserData()
  .then(() => {
    console.log('\n🏁 Debug concluído');
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
  });