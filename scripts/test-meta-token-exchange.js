const axios = require('axios');

async function testTokenExchange(authCode) {
    console.log('🔄 Testando troca de código por token...\n');
    
    const META_APP_ID = '925924588141447';
    const META_APP_SECRET = 'f2dd1158ed69524c46b6c64f2b19fc59';
    const REDIRECT_URI = 'http://localhost:3000/api/meta/callback';
    
    try {
        console.log('📤 Fazendo requisição para trocar código por token...');
        console.log('Código:', authCode.substring(0, 20) + '...');
        
        const response = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
            params: {
                client_id: META_APP_ID,
                client_secret: META_APP_SECRET,
                redirect_uri: REDIRECT_URI,
                code: authCode
            }
        });
        
        console.log('✅ Token obtido com sucesso!');
        console.log('Response:', response.data);
        
        // Testar o token obtido
        if (response.data.access_token) {
            console.log('\n🧪 Testando token obtido...');
            
            const accountsResponse = await axios.get('https://graph.facebook.com/v21.0/me/adaccounts', {
                params: {
                    access_token: response.data.access_token,
                    fields: 'id,name,account_status,currency'
                }
            });
            
            console.log('✅ Contas de anúncios encontradas:');
            console.log(accountsResponse.data);
        }
        
    } catch (error) {
        console.error('❌ Erro na troca de token:');
        console.error('Status:', error.response?.status);
        console.error('Data:', error.response?.data);
        console.error('Message:', error.message);
        
        if (error.response?.data?.error?.code === 100) {
            console.log('\n💡 Dica: O código de autorização pode ter expirado.');
            console.log('Códigos do Facebook expiram em poucos minutos.');
            console.log('Tente gerar um novo código usando a URL de autorização.');
        }
    }
}

// Verificar se foi passado um código como argumento
const authCode = process.argv[2];

if (!authCode) {
    console.log('❌ Por favor, forneça o código de autorização como argumento:');
    console.log('node scripts/test-meta-token-exchange.js SEU_CODIGO_AQUI');
    console.log('\nPara obter um novo código, acesse:');
    console.log('https://www.facebook.com/v21.0/dialog/oauth?client_id=925924588141447&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fmeta%2Fcallback&scope=ads_management,ads_read,business_management,pages_read_engagement,pages_show_list&response_type=code&state=client_test_' + Date.now());
} else {
    testTokenExchange(authCode).catch(console.error);
}