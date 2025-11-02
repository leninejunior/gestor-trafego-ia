const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSuperAdmin(supabase, userId) {
  const { data: userRole } = await supabase
    .from("memberships")
    .select(`
      role_id,
      user_roles (
        name
      )
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  return userRole?.user_roles?.name === 'super_admin';
}

async function testarCheckSuperAdmin() {
  try {
    console.log('🧪 TESTANDO FUNÇÃO checkSuperAdmin');
    console.log('==================================\n');

    // 1. Buscar usuário admin@sistema.com
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const adminUser = authUsers.users.find(u => u.email === 'admin@sistema.com');
    
    console.log('✅ Usuário encontrado:', adminUser.id);
    
    // 2. Testar a função checkSuperAdmin
    console.log('🔍 Testando função checkSuperAdmin...');
    const isSuperAdmin = await checkSuperAdmin(supabase, adminUser.id);
    console.log('🎯 Resultado:', isSuperAdmin);
    
    // 3. Verificar dados manualmente
    console.log('\n📋 Verificação manual dos dados:');
    const { data: membership } = await supabase
      .from("memberships")
      .select(`
        id,
        user_id,
        role_id,
        status,
        user_roles (
          id,
          name
        )
      `)
      .eq("user_id", adminUser.id)
      .eq("status", "active");
    
    console.log('Memberships encontrados:', membership?.length || 0);
    if (membership) {
      membership.forEach(m => {
        console.log(`  - ID: ${m.id}`);
        console.log(`    Role ID: ${m.role_id}`);
        console.log(`    Role Name: ${m.user_roles?.name}`);
        console.log(`    Status: ${m.status}`);
      });
    }
    
    // 4. Fazer login e testar API diretamente
    console.log('\n🔐 Testando API com autenticação...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@sistema.com',
      password: 'admin123456'
    });

    if (authError) {
      console.error('❌ Erro no login:', authError.message);
      return;
    }

    // Criar cliente autenticado
    const authenticatedSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${authData.session.access_token}`
          }
        }
      }
    );

    // Testar função com cliente autenticado
    const isAuthenticatedSuperAdmin = await checkSuperAdmin(authenticatedSupabase, adminUser.id);
    console.log('🎯 Resultado com cliente autenticado:', isAuthenticatedSuperAdmin);
    
    // Logout
    await supabase.auth.signOut();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testarCheckSuperAdmin();