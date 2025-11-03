require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetaCampaignsStructure() {
  console.log('🔍 Verificando estrutura da tabela meta_campaigns...\n');

  try {
    const { data: campaigns, error } = await supabase
      .from('meta_campaigns')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Erro ao buscar campanhas:', error);
      return;
    }

    if (campaigns && campaigns.length > 0) {
      console.log('✅ Estrutura da tabela meta_campaigns:');
      console.log('Colunas disponíveis:', Object.keys(campaigns[0]));
      console.log('\nExemplo de campanha:');
      console.log(JSON.stringify(campaigns[0], null, 2));
    } else {
      console.log('❌ Nenhuma campanha encontrada');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

checkMetaCampaignsStructure();