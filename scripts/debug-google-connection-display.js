/**
 * Debug Google Connection Display
 * 
 * Investiga por que a conexão Google não aparece no cliente
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('🔍 Investigando exibição da conexão Google Ads...\n');

async function debugConnectionDisplay() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    console.log('📋 1. Verificando conexões Google Ads criadas...');
    
    const { data: connections, error: connectionsError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (connectionsError) {
      console.error('❌ Erro ao buscar conexões:', connectionsError);
      return;
    }
    
    console.log(`✅ Encontradas ${connections.length} conexões Google Ads:`);
    connections.forEach((conn, index) => {
      console.log(`\n📊 Conexão ${index + 1}:`);
      console.log(`  - ID: ${conn.id}`);
      console.log(`  - Client ID: ${conn.client_id}`);
      console.log(`  - User ID: ${conn.user_id}`);
      console.log(`  - Customer ID: ${conn.customer_id}`);
      console.log(`  - Status: ${conn.status}`);
      console.log(`  - Criada em: ${conn.created_at}`);
    });
    
    console.log('\n📋 2. Verificando clientes existentes...');
    
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name')
      .order('name');
    
    if (clientsError) {
      console.error('❌ Erro ao buscar clientes:', clientsError);
      return;
    }
    
    console.log(`✅ Encontrados ${clients.length} clientes:`);
    clients.forEach((client, index) => {
      console.log(`  ${index + 1}. ${client.name} (ID: ${client.id})`);
    });
    
    // Procurar especificamente por "Coan Consultoria"
    const coanClient = clients.find(c => 
      c.name.toLowerCase().includes('coan') || 
      c.name.toLowerCase().includes('consultoria')
    );
    
    if (coanClient) {
      console.log(`\n🎯 Cliente "Coan Consultoria" encontrado: ${coanClient.name} (ID: ${coanClient.id})`);
      
      // Verificar conexões para este cliente
      const { data: coanConnections, error: coanError } = await supabase
        .from('google_ads_connections')
        .select('*')
        .eq('client_id', coanClient.id);
      
      if (coanError) {
        console.error('❌ Erro ao buscar conexões do Coan:', coanError);
      } else {
        console.log(`📊 Conexões Google para ${coanClient.name}: ${coanConnections.length}`);
        coanConnections.forEach((conn, index) => {
          console.log(`  Conexão ${index + 1}: Status ${conn.status}, Customer: ${conn.customer_id}`);
        });
      }
    } else {
      console.log('\n⚠️  Cliente "Coan Consultoria" não encontrado pelos termos de busca');
    }
    
    console.log('\n📋 3. Verificando usuários e organizações...');
    
    const { data: users, error: usersError } = await supabase
      .from('auth.users')
      .select('id, email')
      .limit(5);
    
    if (!usersError && users) {
      console.log(`✅ Usuários encontrados: ${users.length}`);
      users.forEach(user => {
        console.log(`  - ${user.email} (ID: ${user.id})`);
      });
    }
    
    console.log('\n📋 4. Verificando memberships de organização...');
    
    const { data: memberships, error: membershipsError } = await supabase
      .from('organization_memberships')
      .select('user_id, client_id')
      .limit(10);
    
    if (!membershipsError && memberships) {
      console.log(`✅ Memberships encontrados: ${memberships.length}`);
      memberships.forEach((membership, index) => {
        console.log(`  ${index + 1}. User: ${membership.user_id} -> Client: ${membership.client_id}`);
      });
    }
    
    console.log('\n📋 POSSÍVEIS PROBLEMAS:');
    console.log('1. Conexão criada para client_id errado');
    console.log('2. RLS bloqueando visualização da conexão');
    console.log('3. Frontend não consultando a API correta');
    console.log('4. Cache do frontend não atualizado');
    console.log('5. Problema na query de busca de conexões');
    
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('1. Verificar qual client_id foi usado na conexão');
    console.log('2. Verificar se o usuário tem acesso ao cliente correto');
    console.log('3. Testar API de conexões no frontend');
    console.log('4. Verificar componente de exibição de conexões');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar debug
debugConnectionDisplay();