/**
 * Diagnóstico: Por que as campanhas não aparecem após sincronização?
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tentar múltiplos arquivos .env
dotenv.config({ path: join(__dirname, '..', '.env.local') });
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente faltando');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('🔍 DIAGNÓSTICO: Por que as campanhas não aparecem?\n');
  
  const clientId = '19ec44b5-a2c8-4410-bbb2-433f049f45ef'; // Dr Hérnia Andradina
  
  // 1. Verificar conexões
  console.log('1️⃣ Verificando conexões Google Ads...');
  const { data: connections, error: connError } = await supabase
    .from('google_ads_connections')
    .select('*')
    .eq('client_id', clientId);
  
  if (connError) {
    console.error('❌ Erro ao buscar conexões:', connError);
    return;
  }
  
  console.log(`✅ Encontradas ${connections?.length || 0} conexões`);
  connections?.forEach(conn => {
    console.log(`   - ID: ${conn.id}`);
    console.log(`   - Customer ID: ${conn.customer_id}`);
    console.log(`   - Status: ${conn.is_active ? 'ATIVA' : 'INATIVA'}`);
    console.log(`   - Tem access_token: ${!!conn.access_token}`);
    console.log(`   - Tem refresh_token: ${!!conn.refresh_token}`);
    console.log(`   - Token expira em: ${conn.token_expires_at}`);
    console.log(`   - Última sync: ${conn.last_sync_at || 'Nunca'}`);
    console.log('');
  });
  
  // 2. Verificar campanhas
  console.log('\n2️⃣ Verificando campanhas sincronizadas...');
  const { data: campaigns, error: campError } = await supabase
    .from('google_ads_campaigns')
    .select('*')
    .eq('client_id', clientId);
  
  if (campError) {
    console.error('❌ Erro ao buscar campanhas:', campError);
    return;
  }
  
  console.log(`✅ Encontradas ${campaigns?.length || 0} campanhas`);
  campaigns?.forEach(camp => {
    console.log(`   - Nome: ${camp.name || camp.campaign_name}`);
    console.log(`   - ID: ${camp.campaign_id}`);
    console.log(`   - Status: ${camp.status}`);
    console.log(`   - Connection ID: ${camp.connection_id}`);
    console.log('');
  });
  
  // 3. Verificar métricas
  console.log('\n3️⃣ Verificando métricas...');
  const { data: metrics, error: metricsError } = await supabase
    .from('google_ads_metrics')
    .select('*')
    .limit(5);
  
  if (metricsError) {
    console.error('❌ Erro ao buscar métricas:', metricsError);
  } else {
    console.log(`✅ Encontradas métricas na tabela (sample de 5)`);
    console.log(`   Total de registros: ${metrics?.length || 0}`);
  }
  
  // 4. Verificar logs de sync
  console.log('\n4️⃣ Verificando logs de sincronização...');
  const { data: logs, error: logsError } = await supabase
    .from('google_ads_sync_logs')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (logsError) {
    console.error('❌ Erro ao buscar logs:', logsError);
  } else {
    console.log(`✅ Últimos ${logs?.length || 0} logs de sync:`);
    logs?.forEach(log => {
      console.log(`   - ${log.created_at}: ${log.status} - ${log.message || 'sem mensagem'}`);
      if (log.error_details) {
        console.log(`     Erro: ${JSON.stringify(log.error_details)}`);
      }
    });
  }
  
  // 5. Testar query da API
  console.log('\n5️⃣ Testando query que a API usa...');
  const { data: apiTest, error: apiError } = await supabase
    .from('google_ads_connections')
    .select('*')
    .eq('client_id', clientId)
    .not('access_token', 'like', 'mock_%')
    .single();
  
  if (apiError) {
    console.log('❌ Query da API falhou:', apiError.message);
    console.log('   Isso explica por que a API retorna "hasConnection: false"');
  } else {
    console.log('✅ Query da API funcionou!');
    console.log('   Conexão encontrada:', apiTest.id);
  }
  
  // 6. Diagnóstico final
  console.log('\n📊 DIAGNÓSTICO FINAL:');
  console.log('='.repeat(60));
  
  if (!connections || connections.length === 0) {
    console.log('❌ PROBLEMA: Nenhuma conexão encontrada');
    console.log('   Solução: Conectar conta Google Ads');
  } else if (campaigns && campaigns.length > 0) {
    console.log('✅ Campanhas existem no banco!');
    console.log('   Problema pode estar no frontend ou na query da API');
  } else {
    console.log('⚠️ PROBLEMA: Conexão existe mas sem campanhas');
    console.log('   Possíveis causas:');
    console.log('   1. Sincronização não foi executada');
    console.log('   2. Erro durante sincronização');
    console.log('   3. Conta Google Ads não tem campanhas');
  }
  
  if (apiError) {
    console.log('\n⚠️ PROBLEMA CRÍTICO: API não consegue encontrar conexão');
    console.log('   Causa: Query com .single() falha quando há múltiplas conexões');
    console.log('   Solução: Usar .maybeSingle() ou filtrar por is_active');
  }
}

diagnose().catch(console.error);
