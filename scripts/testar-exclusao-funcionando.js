require('dotenv').config();

async function testarExclusaoFuncionando() {
  try {
    console.log('🔍 Testando se a exclusão está funcionando...\n');

    // 1. Verificar quantos usuários aparecem na API antes
    console.log('1. Verificando usuários ANTES da exclusão:');
    const response1 = await fetch('http://localhost:3000/api/admin/users/simple');
    
    if (response1.ok) {
      const data1 = await response1.json();
      console.log(`   Total de usuários: ${data1.users?.length || 0}`);
      
      const userToDelete = data1.users?.find(u => u.id === '9eceeafc-9a92-4287-9b30-2bd05487cac8');
      if (userToDelete) {
        console.log(`   ✅ Usuário teste@exemplo.co ainda aparece na lista`);
        console.log(`      Email: ${userToDelete.email}`);
        console.log(`      Tipo: ${userToDelete.user_type}`);
      } else {
        console.log(`   ❌ Usuário teste@exemplo.co NÃO aparece na lista (já foi excluído)`);
      }
    } else {
      console.log(`   ❌ Erro na API: ${response1.status}`);
    }

    // 2. Verificar no banco de dados se o usuário foi marcado como deletado
    console.log('\n2. Verificando no banco de dados:');
    
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userData, error } = await serviceSupabase
      .from('user_profiles')
      .select('user_id, email, is_deleted, deleted_at, deleted_by')
      .eq('user_id', '9eceeafc-9a92-4287-9b30-2bd05487cac8')
      .single();

    if (error) {
      console.log(`   ❌ Erro ao buscar usuário: ${error.message}`);
    } else if (userData) {
      console.log(`   ✅ Usuário encontrado no banco:`);
      console.log(`      Email: ${userData.email}`);
      console.log(`      Is Deleted: ${userData.is_deleted}`);
      console.log(`      Deleted At: ${userData.deleted_at || 'N/A'}`);
      console.log(`      Deleted By: ${userData.deleted_by || 'N/A'}`);
      
      if (userData.is_deleted) {
        console.log(`   ✅ SUCESSO: Usuário foi marcado como deletado (soft delete)`);
      } else {
        console.log(`   ❌ PROBLEMA: Usuário NÃO foi marcado como deletado`);
      }
    } else {
      console.log(`   ❌ Usuário não encontrado no banco`);
    }

    // 3. Verificar se as memberships foram removidas
    console.log('\n3. Verificando memberships:');
    const { data: memberships } = await serviceSupabase
      .from('memberships')
      .select('*')
      .eq('user_id', '9eceeafc-9a92-4287-9b30-2bd05487cac8');

    if (memberships && memberships.length > 0) {
      console.log(`   📋 ${memberships.length} memberships encontradas:`);
      memberships.forEach((membership, index) => {
        console.log(`      ${index + 1}. Status: ${membership.status}`);
        console.log(`         Removed At: ${membership.removed_at || 'N/A'}`);
        console.log(`         Removed By: ${membership.removed_by || 'N/A'}`);
      });
    } else {
      console.log(`   📋 Nenhuma membership encontrada`);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testarExclusaoFuncionando();