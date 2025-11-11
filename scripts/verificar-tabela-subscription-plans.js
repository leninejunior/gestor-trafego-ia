require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('🔍 VERIFICANDO TABELA subscription_plans\n');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Usando service role para bypass RLS
);

async function verificar() {
  try {
    console.log('📊 Testando acesso à tabela subscription_plans...');
    
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ ERRO:', error.message);
      console.error('Código:', error.code);
      console.error('Detalhes:', error.details);
      console.error('Hint:', error.hint);
      
      console.log('\n💡 SOLUÇÃO:');
      console.log('A tabela subscription_plans não existe ou não está acessível.');
      console.log('Execute o schema SQL para criar as tabelas necessárias.');
      
      return false;
    }
    
    console.log('✅ Tabela subscription_plans existe!');
    console.log('Registros encontrados:', data?.length || 0);
    
    if (data && data.length > 0) {
      console.log('Primeiro registro:', data[0]);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ ERRO CRÍTICO:', error.message);
    return false;
  }
}

verificar();
