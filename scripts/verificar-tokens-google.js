/**
 * Script para verificar tokens do Google Ads no banco
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarTokens(clientName) {
  console.log('\n🔐 VERIFICAÇÃO DE TOKENS GOOGLE ADS');
  console.log('===================================\n');

  try {
    // Buscar cliente
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', `%${clientName}%`);

    if (!clients || clients.length === 0) {
      console.error(`❌ Cliente "${clientName}" não encontrado`);
      return;
    }

    const client = clients[0];
    console.log(`✅ Cliente: ${client.name}\n`);

    // Buscar conexões
    const { data: connections, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('client_id', client.id);

    if (error) {
      console.error('❌ Erro:', error);
      return;
    }

    if (!connections || connections.length === 0) {
      console.error('❌ Nenhuma conexão encontrada');
      return;
    }

    connections.forEach((conn, i) => {
      console.log(`📋 Conexão ${i + 1}:`);
      console.log(`   ID: ${conn.id}`);
      console.log(`   Customer ID: ${conn.customer_id}`);
      console.log(`   Status: ${conn.status}`);
      console.log(`   Access Token: ${conn.access_token ? '✅ Presente' : '❌ Ausente'}`);
      console.log(`   Refresh Token: ${conn.refresh_token ? '✅ Presente' : '❌ Ausente'}`);
      console.log(`   Token Expira: ${conn.token_expires_at || 'N/A'}`);
      console.log(`   Última Sync: ${conn.last_sync_at || 'Nunca'}`);
      
      if (conn.access_token) {
        console.log(`   Access Token (primeiros 50 chars): ${conn.access_token.substring(0, 50)}...`);
      }
      if (conn.refresh_token) {
        console.log(`   Refresh Token (primeiros 50 chars): ${conn.refresh_token.substring(0, 50)}...`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

const clientName = process.argv[2] || 'Andradina';
verificarTokens(clientName);
