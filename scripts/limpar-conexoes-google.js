/**
 * Limpar todas as conexões Google para forçar novo OAuth
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function limparConexoesGoogle() {
  console.log('🧹 Limpando todas as conexões Google...\n');
  
  try {
    // 1. Deletar todas as conexões Google
    const { data: deleted, error } = await supabase
      .from('google_ads_connections')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Deletar todas
      .select();

    if (error) {
      console.error('❌ Erro ao deletar conexões:', error);
    } else {
      console.log(`✅ ${deleted?.length || 0} conexões Google removidas`);
    }

    // 2. Limpar estados OAuth antigos
    const { data: statesDeleted, error: statesError } = await supabase
      .from('oauth_states')
      .delete()
      .eq('provider', 'google')
      .select();

    if (statesError) {
      console.log('⚠️ Erro ao limpar estados OAuth (pode ser normal):', statesError.message);
    } else {
      console.log(`✅ ${statesDeleted?.length || 0} estados OAuth removidos`);
    }

    console.log('\n🎉 Limpeza concluída!');
    console.log('\n📋 Próximos passos:');
    console.log('   1. Acesse: http://localhost:3000/dashboard/clients');
    console.log('   2. Clique em "Conectar Google Ads"');
    console.log('   3. Use sua conta Google REAL com acesso à MCC');
    console.log('   4. Complete o fluxo OAuth');
    console.log('   5. Suas contas reais da MCC aparecerão!');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

limparConexoesGoogle();