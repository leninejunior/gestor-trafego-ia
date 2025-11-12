require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function verificar() {
  console.log('🔍 Verificando tabela client_meta_connections...\n');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variáveis de ambiente não encontradas!');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'OK' : 'FALTANDO');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'OK' : 'FALTANDO');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Tentar buscar dados da tabela
    const { data, error } = await supabase
      .from('client_meta_connections')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ TABELA NÃO EXISTE!');
      console.log('Erro:', error.message);
      console.log('\n📋 VOCÊ PRECISA EXECUTAR O SQL NO SUPABASE:');
      console.log('1. Acesse: https://supabase.com/dashboard');
      console.log('2. Vá em SQL Editor');
      console.log('3. Cole o conteúdo de: database/create-client-meta-connections.sql');
      console.log('4. Execute o SQL');
      return;
    }
    
    console.log('✅ Tabela existe!');
    console.log('📊 Registros encontrados:', data?.length || 0);
    
    if (data && data.length > 0) {
      console.log('\n📦 Dados existentes:');
      data.forEach((row, i) => {
        console.log(`${i + 1}. Cliente: ${row.client_id}, Conta: ${row.ad_account_id}`);
      });
    }
    
  } catch (err) {
    console.error('💥 Erro:', err.message);
  }
}

verificar();
