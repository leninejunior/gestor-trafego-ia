const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inserirMembershipSimples() {
  try {
    console.log('🔧 INSERINDO MEMBERSHIP SIMPLES');
    console.log('===============================\n');

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
    
    // 5. Inserir novo membership
    const { data: newMembership, error: insertError } = await supabase
      .from('memberships')
      .insert({
        user_id: adminUser.id,
        org_id: org.id,
        role_id: superAdminRole.id,
        role: 'super_admin', // Adicionar também o campo role antigo
        status: 'active',
        accepted_at: new Date().toISOString()
      })
      .select();
    
    if (insertError) {
      console.error('❌ Erro ao inserir membership:', insertError);
      
      // Tentar sem o campo organization_id
      console.log('🔄 Tentando inserção alternativa...');
      const { data: altMembership, error: altError } = await supabase
        .from('memberships')
        .insert({
          user_id: adminUser.id,
          org_id: org.id,
          role: 'super_admin',
          status: 'active'
        })
        .select();
      
      if (altError) {
        console.error('❌ Erro na inserção alternativa:', altError);
        return;
      }
      
      console.log('✅ Membership alternativo criado:', altMembership);
    } else {
      console.log('✅ Membership criado com sucesso:', newMembership);
    }
    
    // 6. Verificar resultado
    const { data: verification } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', adminUser.id);
    
    console.log('\n🎯 VERIFICAÇÃO FINAL:');
    if (verification && verification.length > 0) {
      verification.forEach(m => {
        console.log(`✅ Membership ID: ${m.id}`);
        console.log(`   Role: ${m.role}`);
        console.log(`   Role ID: ${m.role_id}`);
        console.log(`   Status: ${m.status}`);
        console.log(`   Org ID: ${m.org_id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

inserirMembershipSimples();