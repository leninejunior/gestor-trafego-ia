/**
 * Listar todas as conexões Google disponíveis
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listarConexoesGoogle() {
  console.log('🔍 Listando conexões Google...\n');

  try {
    const { data: connections, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar conexões:', error);
      return;
    }

    if (!connections || connections.length === 0) {
      console.log('❌ Nenhuma conexão encontrada');
      return;
    }

    console.log(`📋 ${connections.length} conexões encontradas:\n`);

    connections.forEach((conn, index) => {
      console.log(`${index + 1}. ID: ${conn.id}`);
      console.log(`   Client ID: ${conn.client_id}`);
      console.log(`   Customer ID: ${conn.customer_id}`);
      console.log(`   Status: ${conn.status}`);
      console.log(`   Criado: ${new Date(conn.created_at).toLocaleString()}`);
      
      if (conn.expires_at) {
        const expiresAt = new Date(conn.expires_at);
        const now = new Date();
        const expired = expiresAt < now;
        console.log(`   Expira: ${expiresAt.toLocaleString()} ${expired ? '❌ EXPIRADO' : '✅ VÁLIDO'}`);
      }
      
      if (conn.access_token) {
        const tokenStart = conn.access_token.substring(0, 20);
        const isTest = conn.access_token.startsWith('test-');
        console.log(`   Token: ${tokenStart}... ${isTest ? '(TESTE)' : '(REAL)'}`);
      }
      
      console.log('');
    });

    // Encontrar conexões válidas
    const validConnections = connections.filter(conn => {
      if (!conn.expires_at) return false;
      const expiresAt = new Date(conn.expires_at);
      const now = new Date();
      return expiresAt > now;
    });

    if (validConnections.length > 0) {
      console.log(`✅ ${validConnections.length} conexões ainda válidas:`);
      validConnections.forEach(conn => {
        console.log(`   - ${conn.id} (expira em ${new Date(conn.expires_at).toLocaleString()})`);
      });
    } else {
      console.log('❌ Todas as conexões expiraram - é necessário refazer a autenticação');
    }

  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

listarConexoesGoogle().catch(console.error);