/**
 * Script para verificar conexões Google Ads no banco de dados
 * Uso: node scripts/verificar-conexao-google.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarConexoes() {
  console.log('🔍 Verificando conexões Google Ads...\n');

  // 1. Verificar oauth_states
  const { data: states, error: statesError } = await supabase
    .from('oauth_states')
    .select('*')
    .eq('provider', 'google')
    .order('created_at', { ascending: false })
    .limit(5);

  if (statesError) {
    console.error('❌ Erro ao buscar oauth_states:', statesError);
  } else {
    console.log('📋 OAuth States (últimos 5):');
    if (states.length === 0) {
      console.log('   Nenhum state encontrado');
    } else {
      states.forEach(state => {
        console.log(`   - State: ${state.state.substring(0, 20)}...`);
        console.log(`     User ID: ${state.user_id}`);
        console.log(`     Client ID: ${state.client_id}`);
        console.log(`     Used: ${state.used ? '✅' : '❌'}`);
        console.log(`     Created: ${new Date(state.created_at).toLocaleString('pt-BR')}`);
        console.log('');
      });
    }
  }

  // 2. Verificar google_ads_connections
  const { data: connections, error: connectionsError } = await supabase
    .from('google_ads_connections')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (connectionsError) {
    console.error('❌ Erro ao buscar google_ads_connections:', connectionsError);
  } else {
    console.log('\n📋 Google Ads Connections (últimas 5):');
    if (connections.length === 0) {
      console.log('   ⚠️  Nenhuma conexão encontrada!');
    } else {
      connections.forEach(conn => {
        console.log(`   - ID: ${conn.id}`);
        console.log(`     Client ID: ${conn.client_id}`);
        console.log(`     Customer ID: ${conn.customer_id || 'N/A'}`);
        console.log(`     Status: ${conn.is_active ? '✅ Ativo' : '❌ Inativo'}`);
        console.log(`     Created: ${new Date(conn.created_at).toLocaleString('pt-BR')}`);
        console.log('');
      });
    }
  }

  // 3. Verificar pending_google_connections
  const { data: pending, error: pendingError } = await supabase
    .from('pending_google_connections')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (pendingError) {
    console.error('❌ Erro ao buscar pending_google_connections:', pendingError);
  } else {
    console.log('\n📋 Pending Google Connections (últimas 5):');
    if (pending.length === 0) {
      console.log('   Nenhuma conexão pendente');
    } else {
      pending.forEach(p => {
        console.log(`   - ID: ${p.id}`);
        console.log(`     Client ID: ${p.client_id}`);
        console.log(`     Status: ${p.status}`);
        console.log(`     Created: ${new Date(p.created_at).toLocaleString('pt-BR')}`);
        console.log('');
      });
    }
  }

  console.log('\n✅ Verificação concluída!');
}

verificarConexoes().catch(console.error);
