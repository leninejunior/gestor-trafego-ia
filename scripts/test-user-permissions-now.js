require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testUserPermissionsNow() {
  try {
    console.log('🔍 Testando permissões do usuário leninejunior@gmail.com...\n');

    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Testar a função checkSuperAdmin para o usuário
    const userId = 'f7313dc4-e5e1-400b-ba3e-1fee686df937';
    
    const { data: memberships } = await serviceSupabase
      .from("memberships")
      .select(`
        role,
        role_id,
        user_roles (
          name
        )
      `)
      .eq("user_id", userId)
      .eq("status", "active");

    console.log('📋 Memberships encontradas:', JSON.stringify(memberships, null, 2));

    if (!memberships || memberships.length === 0) {
      console.log('❌ Nenhuma membership ativa encontrada');
      return;
    }

    // Verificar se é super admin
    const isSuperAdmin = memberships.some(membership => 
      membership.role === 'super_admin' || 
      membership.user_roles?.name === 'super_admin'
    );

    console.log(`${isSuperAdmin ? '✅' : '❌'} É super admin: ${isSuperAdmin}`);

    if (isSuperAdmin) {
      console.log('\n🎉 SUCESSO! O usuário agora tem permissões de super admin');
      console.log('   Agora ele deve conseguir deletar outros usuários');
      console.log('   Teste novamente no frontend');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

testUserPermissionsNow();