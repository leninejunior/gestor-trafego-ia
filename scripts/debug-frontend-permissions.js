require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function debugFrontendPermissions() {
  try {
    console.log('🔍 Simulando verificação do frontend para leninejunior@gmail.com...\n');

    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Simular o que o frontend faz
    const userId = 'f7313dc4-e5e1-400b-ba3e-1fee686df937';
    const userEmail = 'leninejunior@gmail.com';

    console.log('1. Verificando membership (como no frontend):');
    
    const { data: membership, error } = await serviceSupabase
      .from("memberships")
      .select(`
        role,
        user_roles!memberships_role_id_fkey (
          name,
          permissions
        )
      `)
      .eq("user_id", userId)
      .single();

    if (error) {
      console.log('❌ Erro ao buscar membership:', error.message);
    } else {
      console.log('✅ Membership encontrada:', JSON.stringify(membership, null, 2));
    }

    console.log('\n2. Aplicando lógica do frontend:');
    
    const userRole = membership?.user_roles?.[0];
    console.log('   User Role:', userRole);
    
    const isSuperAdmin = userRole?.name === 'super_admin' || 
                        membership?.role === 'super_admin' ||
                        userEmail === 'lenine.engrene@gmail.com'; // Hardcoded no frontend

    console.log(`   userRole?.name === 'super_admin': ${userRole?.name === 'super_admin'}`);
    console.log(`   membership?.role === 'super_admin': ${membership?.role === 'super_admin'}`);
    console.log(`   userEmail === 'lenine.engrene@gmail.com': ${userEmail === 'lenine.engrene@gmail.com'}`);
    
    console.log(`\n${isSuperAdmin ? '✅' : '❌'} Frontend considera super admin: ${isSuperAdmin}`);

    if (isSuperAdmin) {
      console.log('\n🎯 EXPLICAÇÃO: O usuário consegue ver o painel admin porque:');
      if (userRole?.name === 'super_admin') {
        console.log('   - Tem user_role.name = "super_admin"');
      }
      if (membership?.role === 'super_admin') {
        console.log('   - Tem membership.role = "super_admin"');
      }
      if (userEmail === 'lenine.engrene@gmail.com') {
        console.log('   - Email está hardcoded no frontend');
      }
    } else {
      console.log('\n❌ O usuário NÃO deveria conseguir ver o painel admin');
    }

    console.log('\n3. Verificando diferença entre frontend e backend:');
    console.log('   Frontend: Usa query com join para user_roles');
    console.log('   Backend API: Usa query separada para memberships e user_roles');
    console.log('   Isso pode explicar a diferença de comportamento!');

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

debugFrontendPermissions();