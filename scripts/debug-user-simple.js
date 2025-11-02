require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function debugUserSimple() {
  try {
    console.log('🔍 Verificando usuário leninejunior@gmail.com...\n');

    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar o usuário específico
    const { data: user, error: userError } = await serviceSupabase
      .from('user_profiles')
      .select('*')
      .eq('email', 'leninejunior@gmail.com')
      .single();

    if (userError) {
      console.error('❌ Erro ao buscar usuário:', userError);
      return;
    }

    if (!user) {
      console.log('❌ Usuário não encontrado');
      return;
    }

    console.log('👤 Dados do usuário:');
    console.log(`   Email: ${user.email}`);
    console.log(`   ID: ${user.user_id}`);
    console.log(`   Nome: ${user.first_name} ${user.last_name}`);
    console.log(`   Suspenso: ${user.is_suspended ? 'Sim' : 'Não'}`);

    // Buscar memberships
    const { data: memberships, error: memberError } = await serviceSupabase
      .from('memberships')
      .select('*')
      .eq('user_id', user.user_id);

    if (memberError) {
      console.error('❌ Erro ao buscar memberships:', memberError);
    } else {
      console.log(`\n📋 Memberships: ${memberships.length} encontradas`);
      
      if (memberships.length === 0) {
        console.log('❌ PROBLEMA: Usuário não tem nenhuma membership!');
        console.log('   Isso explica o erro 403 - ele não é super admin');
        
        // Vamos criar uma membership de super admin para ele
        console.log('\n🔧 Criando membership de super admin...');
        
        // Primeiro, buscar o ID da role super_admin
        const { data: superAdminRole } = await serviceSupabase
          .from('user_roles')
          .select('id')
          .eq('name', 'super_admin')
          .single();

        if (!superAdminRole) {
          console.log('❌ Role super_admin não encontrada');
          return;
        }

        // Buscar uma organização existente
        const { data: organization } = await serviceSupabase
          .from('organizations')
          .select('id')
          .limit(1)
          .single();

        if (!organization) {
          console.log('❌ Nenhuma organização encontrada');
          return;
        }

        // Criar a membership
        const { data: newMembership, error: createError } = await serviceSupabase
          .from('memberships')
          .insert({
            user_id: user.user_id,
            organization_id: organization.id,
            org_id: organization.id, // Adicionar também org_id
            role: 'super_admin',
            role_id: superAdminRole.id,
            status: 'active',
            accepted_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Erro ao criar membership:', createError);
        } else {
          console.log('✅ Membership criada com sucesso!');
          console.log(`   ID: ${newMembership.id}`);
          console.log(`   Role: ${newMembership.role}`);
          console.log(`   Status: ${newMembership.status}`);
        }

      } else {
        memberships.forEach((membership, index) => {
          console.log(`   ${index + 1}. Role: ${membership.role}`);
          console.log(`      Status: ${membership.status}`);
          console.log(`      Org ID: ${membership.organization_id}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

debugUserSimple();