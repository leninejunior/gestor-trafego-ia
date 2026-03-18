const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkSchema() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('🔍 Verificando schema do sistema de controle de acesso...\n');

  // Check if user_client_access table exists
  console.log('1. Verificando tabela user_client_access...');
  try {
    const { data, error } = await supabase
      .from('user_client_access')
      .select('id')
      .limit(1);
    
    if (error && error.code === 'PGRST106') {
      console.log('❌ Tabela user_client_access NÃO existe');
      console.log('   → Aplicar migração: database/migrations/09-user-client-access-table-fixed.sql');
      return false;
    } else if (error) {
      console.log('❌ Erro ao verificar user_client_access:', error.message);
      return false;
    } else {
      console.log('✅ Tabela user_client_access existe');
    }
  } catch (e) {
    console.log('❌ Tabela user_client_access NÃO existe (erro capturado)');
    return false;
  }

  // Check if super_admins table exists
  console.log('\n2. Verificando tabela super_admins...');
  try {
    const { data, error } = await supabase
      .from('super_admins')
      .select('id')
      .limit(1);
    
    if (error && error.code === 'PGRST106') {
      console.log('❌ Tabela super_admins NÃO existe');
      return false;
    } else if (error) {
      console.log('❌ Erro ao verificar super_admins:', error.message);
      return false;
    } else {
      console.log('✅ Tabela super_admins existe');
    }
  } catch (e) {
    console.log('❌ Tabela super_admins NÃO existe (erro capturado)');
    return false;
  }

  // Check if memberships has role column
  console.log('\n3. Verificando coluna role em memberships...');
  try {
    const { data, error } = await supabase
      .from('memberships')
      .select('role')
      .limit(1);
    
    if (error && error.message.includes('role')) {
      console.log('❌ Coluna role NÃO existe em memberships');
      return false;
    } else if (error) {
      console.log('❌ Erro ao verificar coluna role:', error.message);
      return false;
    } else {
      console.log('✅ Coluna role existe em memberships');
    }
  } catch (e) {
    console.log('❌ Erro ao verificar coluna role:', e.message);
    return false;
  }

  console.log('\n🎉 Schema do sistema de controle de acesso está completo!');
  console.log('\nPróximos passos:');
  console.log('1. Implementar serviços de controle de acesso');
  console.log('2. Criar testes de propriedade');
  console.log('3. Implementar APIs de gerenciamento');
  
  return true;
}

checkSchema().catch(console.error);