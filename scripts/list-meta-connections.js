/**
 * Script para listar todas as conexões Meta Ads
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listConnections() {
  console.log('🔍 Listando todas as conexões Meta Ads...\n');
  
  const { data: connections, error } = await supabase
    .from('client_meta_connections')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Erro:', error.message);
    return;
  }
  
  console.log(`✅ ${connections.length} conexão(ões) encontrada(s):\n`);
  
  connections.forEach((conn, i) => {
    console.log(`${i + 1}. ID: ${conn.id}`);
    console.log(`   Cliente ID: ${conn.client_id}`);
    console.log(`   Ad Account ID: ${conn.ad_account_id}`);
    console.log(`   Nome: ${conn.account_name}`);
    console.log(`   Ativa: ${conn.is_active}`);
    console.log(`   Criada em: ${conn.created_at}`);
    console.log('');
  });
}

listConnections().catch(console.error);
