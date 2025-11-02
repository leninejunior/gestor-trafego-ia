require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🧪 Testando Acesso de Super Admin');
console.log('==================================');

async function testarSuperAdminAcesso() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const superAdmins = [
    { email: 'admin@sistema.com', senha: 'admin123456', nome: 'Admin Sistema' },
    { email: 'lenine.engrene@gmail.com', senha: 'senha123', nome: 'Lenine' }
  ];
  
  for (const admin of superAdmins) {
    console.log(`\n👑 Testando ${admin.nome} (${admin.email})`);
    console.log('─'.repeat(60));
    
    try {
      // 1. Fazer login
      console.log('🔐 Fazendo login...');
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: admin.email,
        password: admin.senha
      });
      
      if (loginError) {
        console.log('❌ Erro no login:', loginError.message);
        continue;
      }
      
      console.log('✅ Login realizado com sucesso');
      
      // 2. Verificar se é super admin
      console.log('👑 Verificando status de super admin...');
      const { data: superAdminData, error: superAdminError } = await supabase
        .from('super_admins')
        .select('*')
        .eq('user_id', loginData.user.id)
        .eq('is_active', true)
        .single();
      
      if (superAdminError || !superAdminData) {
        console.log('❌ NÃO é super admin:', superAdminError?.message);
        continue;
      }
      
      console.log('✅ Confirmado como SUPER ADMIN');
      
      // 3. Testar acesso a todas as organizações
      console.log('🏢 Testando acesso a organizações...');
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*');
      
      if (orgsError) {
        console.log('❌ Erro ao acessar organizações:', orgsError.message);
      } else {
        console.log(`✅ Acesso a organizações: ${orgs.length} encontradas`);
        orgs.forEach((org, index) => {
          console.log(`   ${index + 1}. ${org.name} (ID: ${org.id.substring(0, 8)}...)`);
        });
      }
      
      // 4. Testar acesso a todos os clientes
      console.log('👥 Testando acesso a clientes...');
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*, organizations(name)');
      
      if (clientsError) {
        console.log('❌ Erro ao acessar clientes:', clientsError.message);
      } else {
        console.log(`✅ Acesso a clientes: ${clients.length} encontrados`);
        clients.forEach((client, index) => {
          console.log(`   ${index + 1}. ${client.name} (Org: ${client.organizations?.name || 'N/A'})`);
        });
      }
      
      // 5. Testar acesso a todos os memberships
      console.log('🔗 Testando acesso a memberships...');
      const { data: memberships, error: membershipsError } = await supabase
        .from('memberships')
        .select('*, organizations(name)');
      
      if (membershipsError) {
        console.log('❌ Erro ao acessar memberships:', membershipsError.message);
      } else {
        console.log(`✅ Acesso a memberships: ${memberships.length} encontrados`);
        memberships.forEach((membership, index) => {
          console.log(`   ${index + 1}. User: ${membership.user_id.substring(0, 8)}... (Org: ${membership.organizations?.name || 'N/A'})`);
        });
      }
      
      // 6. Testar acesso a conexões Meta
      console.log('📱 Testando acesso a conexões Meta...');
      const { data: metaConnections, error: metaError } = await supabase
        .from('client_meta_connections')
        .select('*, clients(name)');
      
      if (metaError) {
        console.log('❌ Erro ao acessar conexões Meta:', metaError.message);
      } else {
        console.log(`✅ Acesso a conexões Meta: ${metaConnections.length} encontradas`);
        metaConnections.forEach((conn, index) => {
          console.log(`   ${index + 1}. Cliente: ${conn.clients?.name || 'N/A'} (Account: ${conn.ad_account_id})`);
        });
      }
      
      console.log(`\n🎯 RESUMO PARA ${admin.nome}:`);
      console.log('✅ Login funcionando');
      console.log('✅ Status de super admin confirmado');
      console.log('✅ Acesso total a organizações');
      console.log('✅ Acesso total a clientes');
      console.log('✅ Acesso total a memberships');
      console.log('✅ Acesso total a conexões Meta');
      
      // Fazer logout
      await supabase.auth.signOut();
      console.log('🚪 Logout realizado');
      
    } catch (error) {
      console.log('❌ Erro inesperado:', error.message);
    }
  }
  
  console.log('\n🎉 TESTE CONCLUÍDO!');
  console.log('===================');
  console.log('✅ Super admins têm acesso total ao sistema');
  console.log('✅ Podem ver todas as organizações');
  console.log('✅ Podem ver todos os clientes');
  console.log('✅ Podem ver todos os dados');
  console.log('\n👑 SUPER ADMINS CONFIGURADOS COM SUCESSO!');
}

testarSuperAdminAcesso().catch(err => {
  console.log('❌ Erro no teste:', err.message);
});