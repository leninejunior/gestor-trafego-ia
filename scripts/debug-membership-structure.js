const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugMembershipStructure() {
  try {
    console.log('🔍 Debugando estrutura de memberships...');

    // Buscar usuário lenine
    const { data: users } = await supabase.auth.admin.listUsers();
    const lenineUser = users.users.find(u => u.email === 'lenine@amitie.com.br');
    
    if (!lenineUser) {
      console.error('❌ Usuário não encontrado');
      return;
    }

    console.log('👤 Usuário encontrado:', lenineUser.email, lenineUser.id);

    // Verificar todas as tabelas de membership possíveis
    console.log('\n📋 Verificando tabela "memberships":');
    const { data: memberships1, error: error1 } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', lenineUser.id);

    console.log('Resultado memberships:', { data: memberships1, error: error1?.message });

    console.log('\n📋 Verificando tabela "organization_memberships":');
    const { data: memberships2, error: error2 } = await supabase
      .from('organization_memberships')
      .select('*')
      .eq('user_id', lenineUser.id);

    console.log('Resultado organization_memberships:', { data: memberships2, error: error2?.message });

    // Verificar organizações
    console.log('\n🏢 Verificando organizações:');
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .limit(5);

    console.log('Organizações:', { data: orgs, error: orgError?.message });

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

debugMembershipStructure();