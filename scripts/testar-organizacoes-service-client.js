require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 TESTANDO SERVICE CLIENT');
console.log('==========================');

const supabaseService = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testarServiceClient() {
  try {
    // 1. Testar acesso às organizações com service client
    console.log('🏢 Testando organizações com service client...');
    
    const { data: orgs, error: orgsError } = await supabaseService
      .from('organizations')
      .select('*')
      .order('name');
    
    if (orgsError) {
      console.log('❌ Erro ao buscar organizações:', orgsError.message);
    } else {
      console.log(`✅ Organizações encontradas: ${orgs.length}`);
      orgs.forEach((org, index) => {
        console.log(`  ${index + 1}. ${org.name} (ID: ${org.id})`);
      });
    }
    
    // 2. Testar acesso aos super admins
    console.log('\n👑 Testando super admins...');
    
    const { data: superAdmins, error: superError } = await supabaseService
      .from('super_admins')
      .select('*');
    
    if (superError) {
      console.log('❌ Erro ao buscar super admins:', superError.message);
    } else {
      console.log(`✅ Super admins encontrados: ${superAdmins.length}`);
      superAdmins.forEach((admin, index) => {
        console.log(`  ${index + 1}. User ID: ${admin.user_id}, Ativo: ${admin.is_active}`);
      });
    }
    
    // 3. Testar usuários
    console.log('\n👥 Testando usuários...');
    
    const { data: users, error: usersError } = await supabaseService.auth.admin.listUsers();
    
    if (usersError) {
      console.log('❌ Erro ao listar usuários:', usersError.message);
    } else {
      console.log(`✅ Usuários encontrados: ${users.users.length}`);
      users.users.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email} (ID: ${user.id})`);
      });
      
      // Encontrar Lenine
      const lenineUser = users.users.find(u => u.email === 'lenine.engrene@gmail.com');
      if (lenineUser) {
        console.log('\n🎯 Usuário Lenine encontrado!');
        console.log('🆔 ID:', lenineUser.id);
        console.log('📧 Email confirmado:', lenineUser.email_confirmed_at ? 'Sim' : 'Não');
        
        // Verificar se Lenine é super admin
        const lenineSuper = superAdmins.find(s => s.user_id === lenineUser.id);
        if (lenineSuper) {
          console.log('👑 Lenine é super admin:', lenineSuper.is_active ? 'Ativo' : 'Inativo');
        } else {
          console.log('❌ Lenine NÃO é super admin');
        }
      }
    }
    
    // 4. Testar memberships
    console.log('\n👥 Testando memberships...');
    
    const { data: memberships, error: memberError } = await supabaseService
      .from('memberships')
      .select('*');
    
    if (memberError) {
      console.log('❌ Erro ao buscar memberships:', memberError.message);
    } else {
      console.log(`✅ Memberships encontrados: ${memberships.length}`);
      memberships.forEach((membership, index) => {
        console.log(`  ${index + 1}. User: ${membership.user_id}, Org: ${membership.org_id}, Role: ${membership.role}`);
      });
    }
    
    console.log('\n🎯 DIAGNÓSTICO COMPLETO!');
    console.log('========================');
    
    const summary = {
      organizations: orgs?.length || 0,
      superAdmins: superAdmins?.length || 0,
      users: users?.users?.length || 0,
      memberships: memberships?.length || 0
    };
    
    console.log('📊 Resumo:');
    Object.entries(summary).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    
    if (summary.organizations > 0 && summary.superAdmins > 0) {
      console.log('\n✅ Dados estão presentes, problema pode ser na API');
    } else {
      console.log('\n❌ Dados faltando no banco');
    }
    
  } catch (error) {
    console.log('❌ Erro inesperado:', error.message);
  }
}

testarServiceClient().catch(err => {
  console.log('❌ Erro na execução:', err.message);
});