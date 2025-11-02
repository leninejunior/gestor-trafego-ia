const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function criarMembershipSuperAdmin() {
  try {
    console.log('🔧 CRIANDO MEMBERSHIP PARA SUPER ADMIN');
    console.log('=====================================\n');

    // 1. Buscar usuário admin@sistema.com
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const adminUser = authUsers.users.find(u => u.email === 'admin@sistema.com');
    
    if (!adminUser) {
      console.log('❌ Usuário admin@sistema.com não encontrado');
      return;
    }
    
    console.log('✅ Usuário encontrado:', adminUser.id);
    
    // 2. Buscar role super_admin
    const { data: superAdminRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('name', 'super_admin')
      .single();
    
    if (!superAdminRole) {
      console.log('❌ Role super_admin não encontrada');
      return;
    }
    
    console.log('✅ Role super_admin encontrada:', superAdminRole.id);
    
    // 3. Buscar ou criar organização padrão
    let { data: defaultOrg } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();
    
    if (!defaultOrg) {
      console.log('📝 Criando organização padrão...');
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: 'Sistema Admin'
        })
        .select('id')
        .single();
      
      if (orgError) {
        console.error('❌ Erro ao criar organização:', orgError);
        return;
      }
      
      defaultOrg = newOrg;
    }
    
    console.log('✅ Organização encontrada:', defaultOrg.id);
    
    // 4. Verificar se já existe membership
    const { data: existingMembership } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', adminUser.id)
      .single();
    
    if (existingMembership) {
      console.log('📝 Atualizando membership existente...');
      const { error: updateError } = await supabase
        .from('memberships')
        .update({
          role_id: superAdminRole.id,
          org_id: defaultOrg.id,
          status: 'active',
          accepted_at: new Date().toISOString()
        })
        .eq('id', existingMembership.id);
      
      if (updateError) {
        console.error('❌ Erro ao atualizar membership:', updateError);
        return;
      }
      
      console.log('✅ Membership atualizado com sucesso!');
    } else {
      console.log('📝 Criando novo membership...');
      const { error: membershipError } = await supabase
        .from('memberships')
        .insert({
          user_id: adminUser.id,
          org_id: defaultOrg.id,
          role_id: superAdminRole.id,
          status: 'active',
          accepted_at: new Date().toISOString()
        });
      
      if (membershipError) {
        console.error('❌ Erro ao criar membership:', membershipError);
        return;
      }
      
      console.log('✅ Membership criado com sucesso!');
    }
    
    // 5. Verificar resultado final
    const { data: finalCheck } = await supabase
      .from('memberships')
      .select(`
        id,
        status,
        user_roles (
          name
        )
      `)
      .eq('user_id', adminUser.id);
    
    console.log('\n🎯 VERIFICAÇÃO FINAL:');
    console.log('====================');
    if (finalCheck && finalCheck.length > 0) {
      finalCheck.forEach(m => {
        console.log(`✅ Membership: ${m.user_roles?.name} (Status: ${m.status})`);
      });
    }
    
    console.log('\n📝 PRÓXIMO PASSO:');
    console.log('Teste novamente o CRUD de usuários');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

criarMembershipSuperAdmin();