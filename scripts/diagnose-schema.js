require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
  console.log('🔍 Diagnóstico do Schema Google Ads\n');
  
  // 1. Verificar se a tabela existe
  console.log('1️⃣ Verificando se google_ads_encryption_keys existe...');
  const { data: tables, error: tablesError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'google_ads%'
      ORDER BY table_name;
    `
  });
  
  if (tablesError) {
    console.log('❌ Erro ao verificar tabelas:', tablesError.message);
    
    // Tentar método alternativo
    console.log('\n2️⃣ Tentando query direta...');
    const { data, error } = await supabase
      .from('google_ads_encryption_keys')
      .select('*')
      .limit(0);
    
    if (error) {
      console.log('❌ Tabela não existe ou erro:', error.message);
      console.log('Código:', error.code);
      console.log('\n💡 Solução: Execute database/migrations/01-google-ads-complete-schema.sql');
    } else {
      console.log('✅ Tabela existe mas está vazia');
      console.log('\n3️⃣ Verificando colunas via INSERT...');
      
      // Tentar inserir para ver quais colunas existem
      const testData = {
        key_data: 'test',
        algorithm: 'aes-256-gcm',
        version: 1,
        key_hash: 'test-' + Date.now(),
        is_active: true
      };
      
      const { error: insertError } = await supabase
        .from('google_ads_encryption_keys')
        .insert(testData);
      
      if (insertError) {
        console.log('❌ Erro ao inserir:', insertError.message);
        console.log('Detalhes:', insertError.details);
        console.log('Hint:', insertError.hint);
        
        // Identificar coluna faltante
        const match = insertError.message.match(/column '(\w+)'/);
        if (match) {
          console.log(`\n💡 Coluna faltante: ${match[1]}`);
          console.log('Solução: Execute database/migrations/02-add-missing-columns.sql');
        }
      } else {
        console.log('✅ Todas as colunas existem!');
        console.log('Dados inseridos:', testData);
        
        // Limpar teste
        await supabase
          .from('google_ads_encryption_keys')
          .delete()
          .eq('key_hash', testData.key_hash);
        console.log('🧹 Registro de teste removido');
      }
    }
  } else {
    console.log('✅ Tabelas encontradas:', tables);
  }
  
  // 4. Verificar conexões existentes
  console.log('\n4️⃣ Verificando conexões Google Ads...');
  const { data: connections, error: connError } = await supabase
    .from('google_ads_connections')
    .select('id, customer_id, is_active')
    .limit(5);
  
  if (connError) {
    console.log('❌ Erro:', connError.message);
  } else {
    console.log(`✅ ${connections.length} conexões encontradas`);
    if (connections.length > 0) {
      console.log('Conexões:', connections);
    }
  }
}

diagnose().catch(console.error);
