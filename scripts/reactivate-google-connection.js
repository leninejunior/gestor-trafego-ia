/**
 * Reativar conexão Google Ads mais recente
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente faltando');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function reactivate() {
  const clientId = '19ec44b5-a2c8-4410-bbb2-433f049f45ef'; // Dr Hérnia Andradina
  
  console.log('🔄 Reativando conexão Google Ads...\n');
  
  // Buscar todas as conexões
  const { data: connections } = await supabase
    .from('google_ads_connections')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  
  if (!connections || connections.length === 0) {
    console.log('❌ Nenhuma conexão encontrada');
    return;
  }
  
  console.log(`📋 Encontradas ${connections.length} conexões:`);
  connections.forEach((conn, i) => {
    console.log(`   ${i + 1}. ID: ${conn.id}`);
    console.log(`      Customer: ${conn.customer_id}`);
    console.log(`      Status: ${conn.status}`);
    console.log(`      Criada: ${conn.created_at}`);
    console.log('');
  });
  
  // Pegar a mais recente
  const latestConnection = connections[0];
  
  console.log(`✅ Reativando conexão mais recente: ${latestConnection.id}`);
  
  // Marcar todas as outras como expiradas
  for (const conn of connections) {
    if (conn.id !== latestConnection.id) {
      await supabase
        .from('google_ads_connections')
        .update({ status: 'expired' })
        .eq('id', conn.id);
      console.log(`   ⏸️  Marcada como expirada: ${conn.id}`);
    }
  }
  
  // Ativar a mais recente
  const { error } = await supabase
    .from('google_ads_connections')
    .update({ status: 'active' })
    .eq('id', latestConnection.id);
  
  if (error) {
    console.error('❌ Erro ao reativar:', error);
    return;
  }
  
  console.log('\n✅ Conexão reativada com sucesso!');
  console.log(`   ID: ${latestConnection.id}`);
  console.log(`   Customer: ${latestConnection.customer_id}`);
}

reactivate().catch(console.error);
