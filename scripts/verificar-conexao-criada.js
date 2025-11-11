require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verificar() {
  console.log('🔍 Verificando conexões Google Ads...\n');
  
  const { data, error } = await supabase
    .from('google_ads_connections')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Erro:', error);
    return;
  }
  
  console.log(`📊 Total de conexões: ${data.length}\n`);
  
  if (data.length > 0) {
    data.forEach((conn, i) => {
      console.log(`${i + 1}. ID: ${conn.id}`);
      console.log(`   Client ID: ${conn.client_id}`);
      console.log(`   Customer ID: ${conn.customer_id}`);
      console.log(`   Status: ${conn.status}`);
      console.log(`   Criado: ${conn.created_at}`);
      console.log(`   Tem tokens: ${!!conn.access_token}\n`);
    });
    
    // Testar com a conexão mais recente
    const latest = data[0];
    console.log('🧪 TESTANDO API COM CONEXÃO MAIS RECENTE...\n');
    
    const url = `http://localhost:3000/api/google/accounts?connectionId=${latest.id}&clientId=${latest.client_id}`;
    console.log('📡 URL:', url);
    
    const response = await fetch(url);
    const result = await response.json();
    
    console.log('\n📊 Resposta:', JSON.stringify(result, null, 2));
  } else {
    console.log('⚠️ Nenhuma conexão encontrada');
    console.log('💡 A conexão não foi salva no banco durante o OAuth');
  }
}

verificar().catch(console.error);
