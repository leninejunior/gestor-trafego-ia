/**
 * Verificar tokens Google e chaves de criptografia
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarTokens() {
  console.log('🔍 Verificando tokens e chaves de criptografia...\n');

  try {
    // Verificar chaves de criptografia
    console.log('🔐 Verificando chaves de criptografia:');
    const { data: keys, error: keysError } = await supabase
      .from('google_ads_encryption_keys')
      .select('*');

    if (keysError) {
      console.error('❌ Erro ao buscar chaves:', keysError);
    } else {
      console.log(`   Total de chaves: ${keys.length}`);
      keys.forEach((key, index) => {
        console.log(`   Chave ${index + 1}: Connection ${key.connection_id}`);
        console.log(`     Tem encrypted_access_token: ${!!key.encrypted_access_token}`);
        console.log(`     Tem encrypted_refresh_token: ${!!key.encrypted_refresh_token}`);
        console.log(`     Criado em: ${key.created_at}`);
      });
    }

    console.log('\n📋 Verificando conexões com detalhes:');
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*');

    if (connError) {
      console.error('❌ Erro ao buscar conexões:', connError);
      return;
    }

    for (const conn of connections) {
      console.log(`\n🔗 Conexão ${conn.id}:`);
      console.log(`   Status: ${conn.status}`);
      console.log(`   Customer ID: ${conn.customer_id}`);
      
      // Verificar se tem chave de criptografia correspondente
      const hasKey = keys.find(k => k.connection_id === conn.id);
      console.log(`   Tem chave de criptografia: ${hasKey ? '✅ SIM' : '❌ NÃO'}`);
      
      if (hasKey) {
        console.log(`   Tokens criptografados disponíveis: ${!!hasKey.encrypted_access_token && !!hasKey.encrypted_refresh_token ? '✅ SIM' : '❌ NÃO'}`);
      }

      // Verificar campos de token na conexão
      console.log(`   access_token na conexão: ${conn.access_token ? '✅ SIM' : '❌ NÃO'}`);
      console.log(`   refresh_token na conexão: ${conn.refresh_token ? '✅ SIM' : '❌ NÃO'}`);
    }

    // Diagnóstico
    console.log('\n🩺 Diagnóstico:');
    if (connections.length === 0) {
      console.log('❌ Nenhuma conexão encontrada - precisa fazer OAuth');
    } else if (keys.length === 0) {
      console.log('❌ Nenhuma chave de criptografia - tokens não foram salvos');
    } else {
      const connectionsWithKeys = connections.filter(c => 
        keys.find(k => k.connection_id === c.id)
      );
      
      if (connectionsWithKeys.length === 0) {
        console.log('❌ Conexões existem mas sem chaves - problema no callback OAuth');
      } else {
        console.log('✅ Conexões e chaves existem - verificar se tokens são válidos');
      }
    }

  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

verificarTokens().catch(console.error);