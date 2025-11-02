const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function corrigirMembershipFinal() {
  try {
    console.log('🔧 CORRIGINDO MEMBERSHIP FINAL');
    console.log('==============================\n');

    // 1. Buscar usuário admin@sistema.com
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const adminUser = authUsers.users.find(u => u.email === 'admin@sistema.com');
    
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
    
    // 4. Deletar membership existente se houver
    await supabase
      .from('memberships')
      .delete()
      .eq('user_id', adminUser.id);
    
    console.log('🗑️ Memberships antigos removidos');
    
    // 5. Inserir com todos os campos necessários
    const { data: newMembership, error: insertError } = await supabase
      .from('memberships')
      .insert({
        user_id: adminUser.id,
        org_id: org.id,
        organization_id: org.id, // Adicionar também este campo
        role_id: superAdminRole.id,
        role: 'super_admin',
        status: 'active',
        accepted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
    
    if (insertError) {
      console.error('❌ Erro ao inserir membership:', insertError);
      return;
    }
    
    console.log('✅ Membership criado com sucesso!');
    
    // 6. Verificar resultado
    const { data: verification } = await supabase
      .from('memberships')
      .select(`
        id,
        status,
        role,
        role_id,
        user_roles (
          name
        )
      `)
      .eq('user_id', adminUser.id);
    
    console.log('\n🎯 VERIFICAÇÃO FINAL:');
    if (verification && verification.length > 0) {
      verification.forEach(m => {
        console.log(`✅ Membership: ${m.user_roles?.name || m.role} (Status: ${m.status})`);
      });
    }
    
    console.log('\n📝 PRÓXIMO PASSO:');
    console.log('Teste novamente o CRUD de usuários');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

corrigirMembershipFinal();