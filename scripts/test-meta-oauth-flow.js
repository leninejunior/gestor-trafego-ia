const axios = require('axios');

async function testMetaOAuthFlow() {
    console.log('🔍 Testando fluxo OAuth do Meta...\n');
    
    // Configurações do .env
    const META_APP_ID = '925924588141447';
    const META_APP_SECRET = 'f2dd1158ed69524c46b6c64f2b19fc59';
    const REDIRECT_URI = 'http://localhost:3000/api/meta/callback';
    
    console.log('📋 Configurações:');
    console.log('- App ID:', META_APP_ID);
    console.log('- Redirect URI:', REDIRECT_URI);
    console.log('- App Secret:', META_APP_SECRET ? 'Configurado' : 'Não configurado');
    console.log();
    
    // Gerar URL de autorização
    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?` +
        `client_id=${META_APP_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=ads_management,ads_read,business_management,pages_read_engagement,pages_show_list&` +
        `response_type=code&` +
        `state=client_test-client-id_${Date.now()}`;
    
    console.log('🔗 URL de autorização gerada:');
    console.log(authUrl);
    console.log();
    
    // Testar se o app está configurado corretamente
    try {
        console.log('🧪 Testando configuração do app...');
        
        // Tentar obter informações do app
        const appResponse = await axios.get(`https://graph.facebook.com/v21.0/${META_APP_ID}`, {
            params: {
                access_token: `${META_APP_ID}|${META_APP_SECRET}`,
                fields: 'name,category,company'
            }
        });
        
        console.log('✅ App encontrado:', appResponse.data);
        console.log();
        
    } catch (error) {
        console.error('❌ Erro ao verificar app:', error.response?.data || error.message);
        console.log();
    }
    
    // Simular troca de código por token (com código fictício para testar estrutura)
    try {
        console.log('🧪 Testando estrutura da troca de código...');
        
        const tokenUrl = 'https://graph.facebook.com/v21.0/oauth/access_token';
        const params = {
            client_id: META_APP_ID,
            client_secret: META_APP_SECRET,
            redirect_uri: REDIRECT_URI,
            code: 'CODIGO_FICTICIO_PARA_TESTE'
        };
        
        console.log('📤 Parâmetros que seriam enviados:');
        console.log(params);
        console.log();
        
        // Não fazer a requisição real pois o código é fictício
        console.log('ℹ️ Não fazendo requisição real pois o código é fictício');
        console.log('📍 URL que seria chamada:', tokenUrl);
        console.log();
        
    } catch (error) {
        console.error('❌ Erro na estrutura:', error.message);
    }
    
    console.log('📝 Próximos passos:');
    console.log('1. Acesse a URL de autorização acima no navegador');
    console.log('2. Autorize o app');
    console.log('3. Copie o código da URL de callback');
    console.log('4. Use o código para testar a troca por token');
}

testMetaOAuthFlow().catch(console.error);