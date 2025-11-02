const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testarAvatarUsuario() {
  try {
    console.log('🧪 TESTANDO AVATAR DO USUÁRIO');
    console.log('=============================\n');

    // 1. Fazer login como super admin
    console.log('🔐 Fazendo login como super admin...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@sistema.com',
      password: 'admin123456'
    });

    if (authError) {
      console.error('❌ Erro no login:', authError.message);
      return;
    }

    console.log('✅ Login realizado com sucesso');
    console.log('👤 Usuário logado:', authData.user.email);

    // 2. Testar API de informações do usuário
    console.log('\n📋 Testando API /api/user/info...');
    const response = await fetch('http://localhost:3000/api/user/info', {
      headers: {
        'Authorization': `Bearer ${authData.session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const userInfo = await response.json();
      console.log('✅ API funcionando corretamente');
      console.log('📊 Dados retornados:');
      console.log('  Email:', userInfo.email);
      console.log('  Nome:', userInfo.displayName);
      console.log('  Organização:', userInfo.orgName);
      console.log('  Role:', userInfo.role);
      console.log('  Plano:', userInfo.planName);
    } else {
      const error = await response.json();
      console.log('❌ Erro na API:', error);
    }

    // 3. Verificar dados diretamente no banco
    console.log('\n🔍 Verificando dados no banco...');
    
    // Buscar perfil do usuário
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', authData.user.id)
      .single();

    console.log('👤 Perfil do usuário:');
    if (userProfile) {
      console.log('  ID:', userProfile.user_id);
      console.log('  Nome:', userProfile.first_name, userProfile.last_name);
      console.log('  Email:', userProfile.email);
    } else {
      console.log('  ❌ Perfil não encontrado');
    }

    // Buscar membership
    const { data: membership } = await supabase
      .from('memberships')
      .select(`
        role,
        org_id,
        status,
        user_roles (
          name
        )
      `)
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .single();

    console.log('🏢 Membership:');
    if (membership) {
      console.log('  Role:', membership.role);
      console.log('  Role Name:', membership.user_roles?.name);
      console.log('  Org ID:', membership.org_id);
      console.log('  Status:', membership.status);
    } else {
      console.log('  ❌ Membership não encontrado');
    }

    // Verificar super admin
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', authData.user.id)
      .eq('is_active', true)
      .single();

    console.log('👑 Super Admin:');
    if (superAdmin) {
      console.log('  ✅ É super admin');
      console.log('  Ativo:', superAdmin.is_active);
    } else {
      console.log('  ❌ Não é super admin');
    }

    // 4. Logout
    await supabase.auth.signOut();
    console.log('\n🚪 Logout realizado');

    console.log('\n🎯 RESUMO:');
    console.log('===========');
    console.log('✅ Se todos os dados foram exibidos corretamente,');
    console.log('   o avatar do usuário deve estar funcionando.');
    console.log('❌ Se há dados faltando, verifique a API /api/user/info');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testarAvatarUsuario();