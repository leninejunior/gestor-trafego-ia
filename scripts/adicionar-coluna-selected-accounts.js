/**
 * Adicionar coluna selected_accounts na tabela google_ads_connections
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function adicionarColuna() {
  console.log('🔧 Adicionando coluna selected_accounts...\n');

  try {
    // Adicionar coluna selected_accounts como JSONB
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE google_ads_connections 
        ADD COLUMN IF NOT EXISTS selected_accounts JSONB;
      `
    });

    if (error) {
      console.error('❌ Erro ao adicionar coluna:', error);
      return;
    }

    console.log('✅ Coluna selected_accounts adicionada com sucesso!');

    // Verificar se foi adicionada
    const { data, error: selectError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .limit(1);

    if (selectError) {
      console.error('❌ Erro ao verificar:', selectError);
      return;
    }

    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      if (columns.includes('selected_accounts')) {
        console.log('✅ Verificação: Coluna selected_accounts existe agora!');
      } else {
        console.log('❌ Verificação: Coluna ainda não aparece');
      }
    }

  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

adicionarColuna().catch(console.error);