/**
 * Verificar políticas RLS na tabela google_ads_connections
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Usar service role para ver tudo
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Usar cliente normal para simular usuário autenticado
const supabaseUser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verificarRLS() {
  console.log('🔍 Verificando RLS na tabela google_ads_connections...\n');

  try {
    // Testar com service role (admin)
    console.log('👑 Testando com SERVICE ROLE (admin):');
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('google_ads_connections')
      .select('id, client_id, customer_id, status')
      .eq('client_id', 'e0ae65bf-1f97-474a-988e-a5418ab28e77');

    if (adminError) {
      console.error('   ❌ Erro com service role:', adminError);
    } else {
      console.log(`   ✅ ${adminData.length} conexões encontradas com service role`);
      adminData.forEach((conn, index) => {
        console.log(`      ${index + 1}. ${conn.id} - Customer: ${conn.customer_id}`);
      });
    }

    console.log('\n👤 Testando com ANON KEY (usuário não autenticado):');
    const { data: anonData, error: anonError } = await supabaseUser
      .from('google_ads_connections')
      .select('id, client_id, customer_id, status')
      .eq('client_id', 'e0ae65bf-1f97-474a-988e-a5418ab28e77');

    if (anonError) {
      console.error('   ❌ Erro com anon key:', anonError);
    } else {
      console.log(`   ✅ ${anonData.length} conexões encontradas com anon key`);
    }

    // Verificar se RLS está habilitado
    console.log('\n🔒 Verificando se RLS está habilitado...');
    const { data: rlsInfo, error: rlsError } = await supabaseAdmin
      .rpc('check_rls_enabled', { table_name: 'google_ads_connections' });

    if (rlsError) {
      console.log('   ⚠️  Não foi possível verificar RLS:', rlsError.message);
    } else {
      console.log('   RLS habilitado:', rlsInfo);
    }

  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

verificarRLS().catch(console.error);