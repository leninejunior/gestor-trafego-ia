/**
 * Criar conexão permanente para testes
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function criarConexaoPermanente() {
  console.log('🔧 Criando conexão permanente...\n');

  try {
    const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77'; // Coan Consultoria

    // Limpar conexões antigas
    await supabase
      .from('google_ads_connections')
      .delete()
      .eq('client_id', clientId);

    // Criar nova conexão com token que não expira por 24 horas
    const newConnection = {
      id: crypto.randomUUID(),
      client_id: clientId,
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      customer_id: '1234567890',
      access_token: `ya29.permanent-token-${Date.now()}`,
      refresh_token: `1//permanent-refresh-${Date.now()}`,
      expires_at: new Date(Date.now() + 86400000).toISOString(), // 24 horas
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: createdConnection, error: createError } = await supabase
      .from('google_ads_connections')
      .insert(newConnection)
      .select()
      .single();

    if (createError) {
      console.error('❌ Erro ao criar conexão:', createError);
      return;
    }

    console.log('✅ Conexão permanente criada:', createdConnection.id);
    console.log('⏰ Expira em:', new Date(createdConnection.expires_at).toLocaleString());

    // Atualizar script de teste
    const fs = require('fs');
    const scriptPath = 'scripts/testar-api-google-direta.js';
    let scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    // Substituir o connectionId no script
    scriptContent = scriptContent.replace(
      /const connectionId = '[^']+';/,
      `const connectionId = '${createdConnection.id}';`
    );
    
    fs.writeFileSync(scriptPath, scriptContent);
    console.log('✅ Script de teste atualizado');

    console.log('\n🎉 Use esta URL para testar:');
    console.log(`http://localhost:3000/google/select-accounts?connectionId=${createdConnection.id}&clientId=${clientId}`);

  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

criarConexaoPermanente().catch(console.error);