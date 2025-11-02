const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function corrigirMembershipAdmin() {
  try {
    console.log('🔧 CORRIGINDO MEMBERSHIP DO ADMIN');
    console.log('=================================\n');

    // 1. Buscar usuário admin@sistema.com
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const adminUser = authUsers.users.find(u => u.email === 'admin@sistema.com');
    
    if (!adminUser) {
      console.log('❌ Usuário admin@sistema.com não encontrado');
      return;
    }
    
    console.log('✅ Usuário encontrado:', adminUser.id);
    
    // 2. Buscar role super_admin
    const { data: superAdminRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('name', 'super_admin')
      .single();
    
    console.log('✅ Role super_admin:', superAdminRole.id);
    
    // 3. Buscar organização
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();
    
    console.log('✅ Organização:', org.id);
    
    // 4. Usar SQL direto para inserir
    const { data: insertResult, error: insertError } = await supabase.rpc('exec', {
      sql: `
        INSERT INTO memberships (
          user_id, 
          org_id, 
          organization_id, 
          role_id, 
          status, 
          accepted_at,
          created_at,
          updated_at
        ) VALUES (
          '${adminUser.id}',
          '${org.id}',
          '${org.id}',
          '${superAdminRole.id}',
          'active',
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id, org_id) 
        DO UPDATE SET 
          role_id = '${superAdminRole.id}',
          status = 'active',
          accepted_at = NOW(),
          updated_at = NOW();
      `
    });
    
    if (insertError) {
      console.error('❌ Erro ao inserir membership:', insertError);
      return;
    }
    
    console.log('✅ Membership criado/atualizado com sucesso!');
    
    // 5. Verificar resultado
    const { data: verification } = await supabase
      .from('memberships')
      .select(`
        id,
        status,
        user_roles (
          name
        )
      `)
      .eq('user_id', adminUser.id);
    
    console.log('\n🎯 VERIFICAÇÃO FINAL:');
    if (verification && verification.length > 0) {
      verification.forEach(m => {
        console.log(`✅ Membership: ${m.user_roles?.name} (Status: ${m.status})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

corrigirMembershipAdmin();