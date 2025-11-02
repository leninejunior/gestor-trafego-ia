const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarSuperAdmin() {
  try {
    console.log('🔍 VERIFICANDO SUPER ADMIN');
    console.log('=========================\n');

    // 1. Buscar usuário admin@sistema.com
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const adminUser = authUsers.users.find(u => u.email === 'admin@sistema.com');
    
    if (!adminUser) {
      console.log('❌ Usuário admin@sistema.com não encontrado');
      return;
    }
    
    console.log('✅ Usuário encontrado:', adminUser.id);
    
    // 2. Verificar memberships
    const { data: memberships } = await supabase
      .from('memberships')
      .select(`
        id,
        user_id,
        role,
        role_id,
        status,
        user_roles (
          id,
          name,
          permissions
        )
      `)
      .eq('user_id', adminUser.id);
    
    console.log('📋 Memberships encontrados:', memberships?.length || 0);
    if (memberships) {
      memberships.forEach(m => {
        console.log(`  - Role ID: ${m.role_id}, Role Name: ${m.user_roles?.name}, Status: ${m.status}`);
      });
    }
    
    // 3. Verificar super_admins table
    const { data: superAdmins } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', adminUser.id);
    
    console.log('👑 Super admin records:', superAdmins?.length || 0);
    if (superAdmins) {
      superAdmins.forEach(sa => {
        console.log(`  - Active: ${sa.is_active}, Created: ${sa.created_at}`);
      });
    }
    
    // 4. Verificar user_roles table
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('*');
    
    console.log('🎭 User roles disponíveis:', userRoles?.length || 0);
    if (userRoles) {
      userRoles.forEach(ur => {
        console.log(`  - ${ur.name} (ID: ${ur.id})`);
      });
    }
    
    // 5. Testar função de verificação
    const { data: checkResult } = await supabase.rpc('exec', {
      sql: `
        SELECT 
          m.user_id,
          m.role_id,
          ur.name as role_name,
          m.status
        FROM memberships m
        LEFT JOIN user_roles ur ON m.role_id = ur.id
        WHERE m.user_id = '${adminUser.id}'
        AND m.status = 'active';
      `
    });
    
    console.log('🔍 Resultado da verificação SQL:', checkResult);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

verificarSuperAdmin();