require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkColumns() {
  console.log('Verificando colunas da tabela google_ads_encryption_keys...\n');
  
  // Tentar query simples
  const { data, error } = await supabase
    .from('google_ads_encryption_keys')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('❌ Erro:', error.message);
    console.log('Código:', error.code);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('✅ Colunas existentes:', Object.keys(data[0]));
  } else {
    console.log('⚠️ Tabela vazia, não é possível verificar colunas');
    console.log('Tentando inserir registro de teste...');
    
    const { error: insertError } = await supabase
      .from('google_ads_encryption_keys')
      .insert({
        key_data: 'test',
        key_hash: 'test-hash-' + Date.now()
      });
    
    if (insertError) {
      console.log('❌ Erro ao inserir:', insertError.message);
      console.log('Detalhes:', insertError.details);
    } else {
      console.log('✅ Registro de teste inserido');
    }
  }
}

checkColumns().catch(console.error);
