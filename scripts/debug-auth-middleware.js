const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugAuth() {
  try {
    console.log('🔍 Debugando autenticação...');
    
    // Verificar se conseguimos acessar o Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('👤 User from auth:', user ? 'Found' : 'Not found');
    console.log('❌ Auth error:', authError?.message || 'None');
    
    // Verificar tabelas de admin
    console.log('\n🔍 Verificando tabelas de admin...');
    
    try {
      const { data: superAdmins, error: superError } = await supabase
        .from('super_admins')
        .select('*')
        .limit(5);
      
      console.log('🔧 Super admins table:', superError ? `Error: ${superError.message}` : `Found ${superAdmins?.length || 0} records`);
    } catch (e) {
      console.log('🔧 Super admins table: Not accessible');
    }
    
    try {
      const { data: memberships, error: memberError } = await supabase
        .from('memberships')
        .select('*')
        .limit(5);
      
      console.log('🔧 Memberships table:', memberError ? `Error: ${memberError.message}` : `Found ${memberships?.length || 0} records`);
    } catch (e) {
      console.log('🔧 Memberships table: Not accessible');
    }
    
    // Verificar variáveis de ambiente
    console.log('\n🔍 Verificando variáveis de ambiente...');
    console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
    console.log('🔧 SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not set');
    console.log('🔧 SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set');
    
  } catch (error) {
    console.log('❌ Debug error:', error.message);
  }
}

debugAuth();