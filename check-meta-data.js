/**
 * Verificar dados Meta no banco
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variáveis ausentes: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_KEY).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkData() {
  console.log('📊 VERIFICANDO DADOS META NO BANCO\n');
  
  // Conexões
  const { data: connections } = await supabase
    .from('client_meta_connections')
    .select('*');
  console.log(`✅ Conexões: ${connections?.length || 0}`);
  if (connections?.length > 0) {
    connections.forEach(c => {
      console.log(`   - ${c.account_name} (${c.ad_account_id}) - Active: ${c.is_active}`);
    });
  }
  
  // Campanhas
  const { data: campaigns } = await supabase
    .from('meta_campaigns')
    .select('*');
  console.log(`\n📢 Campanhas: ${campaigns?.length || 0}`);
  if (campaigns?.length > 0) {
    campaigns.slice(0, 5).forEach(c => {
      console.log(`   - ${c.name} (${c.external_id})`);
    });
  }
  
  // Adsets
  const { data: adsets } = await supabase
    .from('meta_adsets')
    .select('*');
  console.log(`\n🎯 Conjuntos de Anúncios: ${adsets?.length || 0}`);
  
  // Ads
  const { data: ads } = await supabase
    .from('meta_ads')
    .select('*');
  console.log(`\n📱 Anúncios: ${ads?.length || 0}`);
  
  console.log('\n' + '='.repeat(50));
  if (!campaigns || campaigns.length === 0) {
    console.log('\n⚠️  PROBLEMA: Não há campanhas sincronizadas!');
    console.log('\n💡 SOLUÇÃO: Sincronizar dados do Meta Ads');
    console.log('   1. Acesse: http://localhost:3000/dashboard/clients/e3ab33da-79f9-45e9-a43f-6ce76ceb9751');
    console.log('   2. Clique em "Sincronizar Campanhas"');
    console.log('   3. Aguarde a sincronização completar');
  }
}

checkData().then(() => process.exit(0));
