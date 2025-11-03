const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTables() {
  try {
    // Verificar tabelas relacionadas a usuários
    const tables = ['user_roles', 'memberships', 'organizations'];
    
    for (const table of tables) {
      console.log(`Verificando tabela: ${table}`);
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`  ❌ Erro: ${error.message}`);
        } else {
          console.log(`  ✅ Existe, ${data?.length || 0} registros encontrados`);
        }
      } catch (err) {
        console.log(`  ❌ Erro: ${err.message}`);
      }
    }

    // Verificar auth.users usando RPC ou query direta
    console.log('\nVerificando usuários autenticados...');
    try {
      const { data: { users }, error } = await supabase.auth.admin.listUsers();
      if (error) {
        console.log(`❌ Erro ao listar usuários: ${error.message}`);
      } else {
        console.log(`✅ Encontrados ${users?.length || 0} usuários autenticados`);
        if (users && users.length > 0) {
          console.log(`   Primeiro usuário: ${users[0].email}`);
        }
      }
    } catch (err) {
      console.log(`❌ Erro: ${err.message}`);
    }
  } catch (error) {
    console.error('Erro:', error);
  }
}

checkTables();