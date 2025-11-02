require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function verificarSituacaoReal() {
  try {
    console.log('🔍 Verificação REAL da situação atual...\n');

    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verificar usuário específico leninejunior@gmail.com
    console.log('1. 👤 USUÁRIO leninejunior@gmail.com:');
    const { data: user, error: userError } = await serviceSupabase
      .from('user_profiles')
      .select('*')
      .eq('email', 'leninejunior@gmail.com')
      .single();

    if (userError) {
      console.log('❌ Erro ao buscar usuário:', userError.message);
      return;
    }

    console.log(`   Email: ${user.email}`);
    console.log(`   ID: ${user.user_id}`);
    console.log(`   Nome: ${user.first_name || 'VAZIO'} ${user.last_name || 'VAZIO'}`);
    console.log(`   Avatar URL: ${user.avatar_url || 'VAZIO'}`);

    // 2. Verificar memberships separadamente
    console.log('\n2. 📋 MEMBERSHIPS do usuário:');
    const { data: memberships, error: memberError } = await serviceSupabase
      .from('memberships')
      .select('*')
      .eq('user_id', user.user_id);

    if (memberError) {
      console.log('❌ Erro ao buscar memberships:', memberError.message);
    } else {
      console.log(`   Total: ${memberships.length} memberships`);
      memberships.forEach((membership, index) => {
        console.log(`   ${index + 1}. ID: ${membership.id}`);
        console.log(`      Role: ${membership.role}`);
        console.log(`      Role ID: ${membership.role_id}`);
        console.log(`      Status: ${membership.status}`);
        console.log(`      Org ID: ${membership.organization_id}`);
      });
    }

    // 3. Verificar user_roles se existir role_id
    if (memberships && memberships.length > 0) {
      console.log('\n3. 🔐 USER ROLES:');
      for (const membership of memberships) {
        if (membership.role_id) {
          const { data: role, error: roleError } = await serviceSupabase
            .from('user_roles')
            .select('*')
            .eq('id', membership.role_id)
            .single();

          if (roleError) {
            console.log(`   ❌ Erro ao buscar role ${membership.role_id}: ${roleError.message}`);
          } else {
            console.log(`   ✅ Role encontrada: ${role.name} (${role.description})`);
          }
        }
      }
    }

    // 4. Testar a API que está sendo usada no frontend
    console.log('\n4. 🌐 TESTANDO API /api/admin/users/simple:');
    try {
      const response = await fetch('http://localhost:3000/api/admin/users/simple');
      console.log(`   Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   Usuários retornados: ${data.users?.length || 0}`);
        
        const leninejuniorInAPI = data.users?.find(u => u.email === 'leninejunior@gmail.com');
        if (leninejuniorInAPI) {
          console.log('   ✅ leninejunior@gmail.com encontrado na API:');
          console.log(`      user_type: ${leninejuniorInAPI.user_type}`);
          console.log(`      memberships: ${leninejuniorInAPI.memberships?.length || 0}`);
        } else {
          console.log('   ❌ leninejunior@gmail.com NÃO encontrado na API');
        }
      } else {
        const errorText = await response.text();
        console.log(`   ❌ Erro na API: ${errorText}`);
      }
    } catch (fetchError) {
      console.log(`   ❌ Erro ao chamar API: ${fetchError.message}`);
    }

    // 5. Verificar se o problema é no tipo de usuário
    console.log('\n5. 🎯 DIAGNÓSTICO:');
    
    const isSuperAdminByRole = memberships?.some(m => m.role === 'super_admin');
    const isSuperAdminByRoleId = memberships?.some(m => m.role_id && m.role_id === '235c2953-b22a-4b71-bb2e-0785659397f1'); // ID do super_admin
    
    console.log(`   É super admin por role: ${isSuperAdminByRole}`);
    console.log(`   É super admin por role_id: ${isSuperAdminByRoleId}`);
    
    if (!isSuperAdminByRole && !isSuperAdminByRoleId) {
      console.log('   ❌ PROBLEMA: Usuário NÃO é reconhecido como super admin');
      console.log('   💡 SOLUÇÃO: Precisa corrigir as memberships');
    } else {
      console.log('   ✅ Usuário DEVERIA ser reconhecido como super admin');
      console.log('   💡 PROBLEMA: Pode ser na API ou no frontend');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

verificarSituacaoReal();