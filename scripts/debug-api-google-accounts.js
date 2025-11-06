/**
 * Debug da API Google Accounts - simular exatamente o que ela faz
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function debugAPIGoogleAccounts() {
  console.log('🔍 Debugando API Google Accounts...\n');

  const connectionId = '92e769bc-691c-4faf-87e3-1c138716d9bf';

  try {
    // 1. Simular o que a API faz - criar cliente Supabase
    console.log('📡 Criando cliente Supabase (como na API)...');
    
    // A API usa createClient() que é o cliente normal
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    console.log('✅ Cliente criado');

    // 2. Simular verificação de usuário autenticado
    console.log('\n👤 Verificando usuário autenticado...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('User:', user ? `${user.id} (${user.email})` : 'null');
    console.log('Auth Error:', authError ? authError.message : 'null');

    if (!user) {
      console.log('❌ Usuário não autenticado - isso explica o problema!');
      console.log('   A API precisa de um usuário autenticado para acessar as conexões');
      console.log('   Mas estamos testando sem autenticação');
    }

    // 3. Tentar buscar conexão mesmo assim
    console.log('\n🔍 Tentando buscar conexão...');
    const { data: connection, error: connectionError } = await supabase
      .from('google_ads_connections')
      .select('id, client_id, customer_id, status, access_token, refresh_token, expires_at')
      .eq('id', connectionId)
      .single();

    console.log('Connection:', connection);
    console.log('Connection Error:', connectionError);

    if (connectionError) {
      console.log('❌ Erro ao buscar conexão:', connectionError.message);
      console.log('   Código:', connectionError.code);
      console.log('   Detalhes:', connectionError.details);
    }

    // 4. Testar com service client (como deveria funcionar)
    console.log('\n🔧 Testando com service client...');
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: serviceConnection, error: serviceError } = await serviceClient
      .from('google_ads_connections')
      .select('id, client_id, customer_id, status, access_token, refresh_token, expires_at')
      .eq('id', connectionId)
      .single();

    if (serviceError) {
      console.log('❌ Erro com service client:', serviceError.message);
    } else {
      console.log('✅ Service client encontrou a conexão:');
      console.log(`   ID: ${serviceConnection.id}`);
      console.log(`   Status: ${serviceConnection.status}`);
      console.log(`   Tem tokens: ${!!serviceConnection.access_token}`);
    }

    // 5. Conclusão
    console.log('\n📋 Conclusão:');
    if (!user && connectionError) {
      console.log('❌ Problema identificado: API precisa de autenticação');
      console.log('   Soluções possíveis:');
      console.log('   1. Usar service client na API (bypass RLS)');
      console.log('   2. Configurar RLS para permitir acesso público');
      console.log('   3. Implementar autenticação adequada');
    }

  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

debugAPIGoogleAccounts().catch(console.error);