require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function investigarProblemasCompletos() {
  try {
    console.log('🔍 Investigando TODOS os problemas do sistema...\n');

    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verificar TODOS os usuários no sistema
    console.log('1. 📊 TODOS OS USUÁRIOS NO SISTEMA:');
    const { data: allUsers, error: usersError } = await serviceSupabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('❌ Erro ao buscar usuários:', usersError);
      return;
    }

    allUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email}`);
      console.log(`      ID: ${user.user_id}`);
      console.log(`      Nome: ${user.first_name || 'N/A'} ${user.last_name || 'N/A'}`);
      console.log(`      Criado: ${user.created_at}`);
      console.log(`      Suspenso: ${user.is_suspended ? 'Sim' : 'Não'}`);
      console.log('');
    });

    // 2. Verificar memberships de TODOS os usuários
    console.log('2. 📋 MEMBERSHIPS DE TODOS OS USUÁRIOS:');
    const { data: allMemberships, error: memberError } = await serviceSupabase
      .from('memberships')
      .select(`
        *,
        user_profiles (email, first_name, last_name),
        user_roles (name, description)
      `)
      .order('created_at', { ascending: false });

    if (memberError) {
      console.error('❌ Erro ao buscar memberships:', memberError);
    } else {
      allMemberships.forEach((membership, index) => {
        console.log(`   ${index + 1}. ${membership.user_profiles?.email || 'Email N/A'}`);
        console.log(`      User ID: ${membership.user_id}`);
        console.log(`      Role: ${membership.role || 'N/A'}`);
        console.log(`      Role ID: ${membership.role_id || 'N/A'}`);
        console.log(`      Role Name: ${membership.user_roles?.name || 'N/A'}`);
        console.log(`      Status: ${membership.status}`);
        console.log(`      Org ID: ${membership.organization_id}`);
        console.log('');
      });
    }

    // 3. Verificar especificamente leninejunior@gmail.com
    console.log('3. 🎯 VERIFICAÇÃO ESPECÍFICA - leninejunior@gmail.com:');
    const leninejuniorUser = allUsers.find(u => u.email === 'leninejunior@gmail.com');
    
    if (!leninejuniorUser) {
      console.log('❌ Usuário leninejunior@gmail.com NÃO ENCONTRADO!');
    } else {
      console.log(`   ✅ Usuário encontrado: ${leninejuniorUser.user_id}`);
      console.log(`   Nome: ${leninejuniorUser.first_name} ${leninejuniorUser.last_name}`);
      
      // Buscar memberships específicas
      const leninejuniorMemberships = allMemberships.filter(m => m.user_id === leninejuniorUser.user_id);
      console.log(`   Memberships: ${leninejuniorMemberships.length} encontradas`);
      
      leninejuniorMemberships.forEach(membership => {
        console.log(`      - Role: ${membership.role}`);
        console.log(`        Role Name: ${membership.user_roles?.name}`);
        console.log(`        Status: ${membership.status}`);
      });
    }

    // 4. Verificar o que a API /api/admin/users/simple retorna
    console.log('\n4. 🔍 SIMULANDO API /api/admin/users/simple:');
    
    // Simular a query da API
    const { data: apiUsers, error: apiError } = await serviceSupabase.auth.admin.listUsers();
    
    if (apiError) {
      console.log('❌ Erro na API de usuários:', apiError);
    } else {
      console.log(`   API retorna ${apiUsers.users.length} usuários do auth:`);
      apiUsers.users.forEach(user => {
        console.log(`      - ${user.email} (ID: ${user.id})`);
      });
    }

    // 5. Verificar inconsistências
    console.log('\n5. ⚠️  INCONSISTÊNCIAS DETECTADAS:');
    
    const authEmails = apiUsers?.users?.map(u => u.email) || [];
    const profileEmails = allUsers.map(u => u.email);
    
    console.log('   Emails no Auth:', authEmails);
    console.log('   Emails nos Profiles:', profileEmails);
    
    const emailsOnlyInAuth = authEmails.filter(email => !profileEmails.includes(email));
    const emailsOnlyInProfiles = profileEmails.filter(email => !authEmails.includes(email));
    
    if (emailsOnlyInAuth.length > 0) {
      console.log('   ❌ Usuários no Auth mas SEM profile:', emailsOnlyInAuth);
    }
    
    if (emailsOnlyInProfiles.length > 0) {
      console.log('   ❌ Usuários com profile mas SEM auth:', emailsOnlyInProfiles);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

investigarProblemasCompletos();