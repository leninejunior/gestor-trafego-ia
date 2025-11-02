require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserPermissions() {
  try {
    console.log('🔍 Verificando permissões detalhadas dos usuários...\n');

    // Buscar todos os usuários
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('*');

    if (usersError) {
      console.error('❌ Erro ao buscar usuários:', usersError);
      return;
    }

    console.log(`📊 Total de usuários: ${users.length}\n`);

    // Para cada usuário, buscar suas memberships e roles
    for (const user of users) {
      console.log(`👤 ${user.email} (${user.first_name} ${user.last_name})`);
      console.log(`   ID: ${user.user_id}`);
      console.log(`   Suspenso: ${user.is_suspended ? 'Sim' : 'Não'}`);
      console.log(`   Deletado: ${user.is_deleted ? 'Sim' : 'Não'}`);

      // Buscar memberships do usuário
      const { data: memberships, error: memberError } = await supabase
        .from('memberships')
        .select('*')
        .eq('user_id', user.user_id);

      if (memberError) {
        console.log(`   ❌ Erro ao buscar memberships: ${memberError.message}`);
      } else if (memberships.length === 0) {
        console.log('   📋 Nenhuma membership encontrada');
      } else {
        for (const membership of memberships) {
          console.log(`   📋 Membership ID: ${membership.id}`);
          console.log(`      Role: ${membership.role || 'N/A'}`);
          console.log(`      Role ID: ${membership.role_id || 'N/A'}`);
          console.log(`      Status: ${membership.status}`);
          console.log(`      Org ID: ${membership.organization_id}`);

          // Buscar detalhes da role se role_id existir
          if (membership.role_id) {
            const { data: roleData, error: roleError } = await supabase
              .from('user_roles')
              .select('*')
              .eq('id', membership.role_id)
              .single();

            if (roleError) {
              console.log(`      ❌ Erro ao buscar role: ${roleError.message}`);
            } else {
              console.log(`      Role Name: ${roleData.name}`);
              console.log(`      Role Description: ${roleData.description}`);
            }
          }

          // Buscar detalhes da organização
          if (membership.organization_id) {
            const { data: orgData, error: orgError } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', membership.organization_id)
              .single();

            if (orgError) {
              console.log(`      ❌ Erro ao buscar organização: ${orgError.message}`);
            } else {
              console.log(`      Organização: ${orgData.name}`);
            }
          }
        }
      }
      console.log('');
    }

    // Verificar especificamente quem tem role de super_admin
    console.log('🔐 Verificando Super Admins...');
    const { data: superAdminMemberships, error: superAdminError } = await supabase
      .from('memberships')
      .select(`
        *,
        user_profiles (email, first_name, last_name),
        user_roles (name, description)
      `)
      .eq('user_roles.name', 'super_admin')
      .eq('status', 'active');

    if (superAdminError) {
      console.log('❌ Erro ao buscar super admins:', superAdminError.message);
      
      // Método alternativo - buscar por role_id
      const { data: superAdminRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('name', 'super_admin')
        .single();

      if (superAdminRole) {
        const { data: superAdmins } = await supabase
          .from('memberships')
          .select(`
            *,
            user_profiles (email, first_name, last_name)
          `)
          .eq('role_id', superAdminRole.id)
          .eq('status', 'active');

        if (superAdmins && superAdmins.length > 0) {
          console.log('✅ Super Admins encontrados (método alternativo):');
          superAdmins.forEach(admin => {
            console.log(`   - ${admin.user_profiles.email} (${admin.user_profiles.first_name} ${admin.user_profiles.last_name})`);
            console.log(`     User ID: ${admin.user_id}`);
          });
        } else {
          console.log('❌ Nenhum super admin ativo encontrado');
        }
      }
    } else {
      console.log('✅ Super Admins encontrados:');
      superAdminMemberships.forEach(admin => {
        console.log(`   - ${admin.user_profiles.email} (${admin.user_profiles.first_name} ${admin.user_profiles.last_name})`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

checkUserPermissions();