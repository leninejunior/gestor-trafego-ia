require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugUserPermissions() {
  try {
    console.log('🔍 Verificando permissões de usuários...\n');

    // Buscar todos os usuários com suas memberships
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select(`
        user_id,
        email,
        first_name,
        last_name,
        is_suspended,
        memberships (
          id,
          role,
          status,
          role_id,
          user_roles (
            name
          ),
          organizations (
            name
          )
        )
      `);

    if (usersError) {
      console.error('❌ Erro ao buscar usuários:', usersError);
      return;
    }

    console.log(`📊 Total de usuários: ${users.length}\n`);

    users.forEach(user => {
      console.log(`👤 ${user.email} (${user.first_name} ${user.last_name})`);
      console.log(`   ID: ${user.user_id}`);
      console.log(`   Suspenso: ${user.is_suspended ? 'Sim' : 'Não'}`);
      
      if (user.memberships && user.memberships.length > 0) {
        user.memberships.forEach(membership => {
          console.log(`   📋 Membership: ${membership.role || 'N/A'} (${membership.status})`);
          console.log(`      Role ID: ${membership.role_id}`);
          console.log(`      Role Name: ${membership.user_roles?.name || 'N/A'}`);
          console.log(`      Organização: ${membership.organizations?.name || 'N/A'}`);
        });
      } else {
        console.log('   📋 Nenhuma membership encontrada');
      }
      console.log('');
    });

    // Verificar especificamente super admins
    console.log('🔐 Super Admins encontrados:');
    const superAdmins = users.filter(user => 
      user.memberships?.some(m => m.user_roles?.name === 'super_admin' && m.status === 'active')
    );

    if (superAdmins.length === 0) {
      console.log('❌ Nenhum super admin encontrado!');
    } else {
      superAdmins.forEach(admin => {
        console.log(`✅ ${admin.email} - ${admin.first_name} ${admin.last_name}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

debugUserPermissions();