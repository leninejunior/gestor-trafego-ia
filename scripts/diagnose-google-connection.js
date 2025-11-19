require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { getGoogleAdsCryptoService } = require('../src/lib/google/crypto-service');
const { getGoogleTokenManager } = require('../src/lib/google/token-manager');
const { getGoogleAdsClient } = require('../src/lib/google/ads-api');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function diagnose() {
  console.log('🚀 Iniciando diagnóstico de conexão com o Google Ads...');

  // 1. Check Environment Variables
  console.log('\n[1/6] Verificando variáveis de ambiente...');
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_DEVELOPER_TOKEN',
    'NEXT_PUBLIC_APP_URL',
    'GOOGLE_TOKEN_ENCRYPTION_KEY'
  ];
  const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingEnvVars.length > 0) {
    console.error('❌ Variáveis de ambiente faltando:', missingEnvVars);
    return;
  }
  console.log('✅ Variáveis de ambiente OK.');

  // 2. Test Supabase Connection
  console.log('\n[2/6] Testando conexão com o Supabase...');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  try {
    const { error } = await supabase.from('clients').select('id').limit(1);
    if (error) throw error;
    console.log('✅ Conexão com o Supabase OK.');
  } catch (error) {
    console.error('❌ Erro ao conectar com o Supabase:', error.message);
    return;
  }

  // 3. Test Encryption Service
  console.log('\n[3/6] Testando serviço de criptografia...');
  try {
    const cryptoService = getGoogleAdsCryptoService();
    const encryptionTest = await cryptoService.testEncryption();
    if (!encryptionTest.success) {
      console.error('❌ Teste de criptografia falhou:', encryptionTest.error);
      return;
    }
    console.log(`✅ Serviço de criptografia OK (versão da chave: ${encryptionTest.keyVersion}).`);
  } catch (error) {
    console.error('❌ Erro no serviço de criptografia:', error.message);
    return;
  }

  // 4. Get Active Connection
  rl.question('\n[4/6] Por favor, insira um client_id para testar: ', async (clientId) => {
    if (!clientId) {
      console.error('❌ client_id é obrigatório.');
      rl.close();
      return;
    }

    console.log(`\n[5/6] Verificando token para o client_id: ${clientId}...`);
    let accessToken;
    try {
      const tokenManager = getGoogleTokenManager();
      const tokenData = await tokenManager.ensureValidTokenForClient(clientId);
      accessToken = tokenData.accessToken;
      console.log('✅ Token de acesso válido obtido.');
    } catch (error) {
      console.error('❌ Erro ao obter token de acesso:', error.message);
      rl.close();
      return;
    }

    // 6. Test Google Ads API Connection
    console.log('\n[6/6] Testando conexão com a API do Google Ads...');
    try {
      const adsClient = getGoogleAdsClient();
      const connectionTest = await adsClient.testConnection(accessToken);
      if (!connectionTest.success) {
        console.error('❌ Teste de conexão com a API falhou:', connectionTest.error);
        rl.close();
        return;
      }
      console.log('✅ Conexão com a API do Google Ads OK.');
    } catch (error) {
      console.error('❌ Erro ao testar a conexão com a API:', error.message);
      rl.close();
      return;
    }

    console.log('\n🎉 Diagnóstico concluído com sucesso! Parece que a conexão está funcionando.');
    rl.close();
  });
}

diagnose();
