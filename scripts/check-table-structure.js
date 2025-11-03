const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableStructure() {
  try {
    console.log('🔍 Verificando estrutura das tabelas...');

    // Tentar inserir um membership simples para ver o erro
    console.log('\n🧪 Testando inserção na tabela memberships...');
    
    const { data: users } = await supabase.auth.admin.listUsers();
    const lenineUser = users.users.find(u => u.email === 'lenine@amitie.com.br');
    
    const { data: orgs } = await supabase
      .from('organizations')
      .select('*')
      .limit(1)
      .single();

    // Testar com ambos os campos
    const { data: test1, error: error1 } = await supabase
      .from('memberships')
      .insert({
        user_id: lenineUser.id,
        organization_id: orgs.id,
        org_id: orgs.id,
        role: 'owner'
      })
      .select();

    console.log('Teste com ambos os campos:', { data: test1, error: error1?.message });

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

checkTableStructure();