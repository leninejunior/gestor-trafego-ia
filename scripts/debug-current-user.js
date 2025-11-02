require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function debugCurrentUser() {
  try {
    console.log('🔍 Verificando usuário atual e suas permissões...\n');

    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar todos os usuários e suas sessões ativas
    console.log('📊 Usuários no sistema:');
    
    const { data: users, error: usersError } = await serviceSupabase
      .from('user_profiles')
      .select(`
        user_id,
        email,
        first_name,
        last_name,
        is_suspended,
        memberships (
          role,
          role_id,
          status,
          user_roles (
            name
          )
        )
      `);

    if (usersError) {
      console.error('❌ Erro ao buscar usuários:', usersError);
      return;
    }

    users.forEach(user => {
      console.log(`\n👤 ${user.email} (${user.first_name} ${user.last_name})`);
      console.log(`   ID: ${user.user_id}`);
      console.log(`   Suspenso: ${user.is_suspended ? 'Sim' : 'Não'}`);
      
      if (user.memberships && user.memberships.length > 0) {
        user.memberships.forEach(membership => {
          const isSuperAdmin = membership.role === 'super_admin' || 
                              membership.user_roles?.name === 'super_admin';
          console.log(`   📋 Role: ${membership.role || 'N/A'} (${membership.status})`);
          console.log(`      Role Name: ${membership.user_roles?.name || 'N/A'}`);
          console.log(`      É Super Admin: ${isSuperAdmin ? '✅ SIM' : '❌ NÃO'}`);
        });
      } else {
        console.log('   📋 Nenhuma membership encontrada');
      }
    });

    // Verificar especificamente o usuário que está tentando deletar
    const userToDelete = '037bd439-2fdc-4d6a-aa71-6a2f8a9175a9';
    console.log(`\n🎯 Verificando usuário a ser deletado: ${userToDelete}`);
    
    const userToDeleteData = users.find(u => u.user_id === userToDelete);
    if (userToDeleteData) {
      console.log(`   Email: ${userToDeleteData.email}`);
      console.log(`   Nome: ${userToDeleteData.first_name} ${userToDeleteData.last_name}`);
      console.log(`   Suspenso: ${userToDeleteData.is_suspended ? 'Sim' : 'Não'}`);
      
      const isSuperAdmin = userToDeleteData.memberships?.some(m => 
        m.role === 'super_admin' || m.user_roles?.name === 'super_admin'
      );
      
      if (isSuperAdmin) {
        console.log('   ⚠️  ATENÇÃO: Este usuário é um SUPER ADMIN!');
        console.log('   ❌ Super admins não podem ser deletados por outros super admins');
      } else {
        console.log('   ✅ Este usuário pode ser deletado por um super admin');
      }
    } else {
      console.log('   ❌ Usuário não encontrado');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

debugCurrentUser();