const axios = require('axios');

async function testCompleteMetaFlow(authCode) {
    console.log('🔄 Testando fluxo completo do Meta...\n');
    
    const META_APP_ID = '925924588141447';
    const META_APP_SECRET = 'f2dd1158ed69524c46b6c64f2b19fc59';
    const REDIRECT_URI = 'http://localhost:3000/api/meta/callback';
    
    try {
        // Passo 1: Trocar código por token
        console.log('📤 Passo 1: Trocando código por access token...');
        const tokenResponse = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
            params: {
                client_id: META_APP_ID,
                client_secret: META_APP_SECRET,
                redirect_uri: REDIRECT_URI,
                code: authCode
            }
        });
        
        const { access_token } = tokenResponse.data;
        console.log('✅ Token obtido com sucesso!');
        console.log('Token:', access_token.substring(0, 20) + '...');
        
        // Passo 2: Buscar contas de anúncios
        console.log('\n📊 Passo 2: Buscando contas de anúncios...');
        const accountsResponse = await axios.get('https://graph.facebook.com/v21.0/me/adaccounts', {
            params: {
                access_token: access_token,
                fields: 'id,name,account_status,currency,timezone_name'
            }
        });
        
        const adAccounts = accountsResponse.data.data || [];
        console.log(`✅ ${adAccounts.length} conta(s) de anúncios encontrada(s):`);
        adAccounts.forEach((account, index) => {
            console.log(`  ${index + 1}. ${account.name} (${account.id}) - Status: ${account.account_status}`);
        });
        
        // Passo 3: Buscar páginas do Facebook
        console.log('\n📄 Passo 3: Buscando páginas do Facebook...');
        const pagesResponse = await axios.get('https://graph.facebook.com/v21.0/me/accounts', {
            params: {
                access_token: access_token,
                fields: 'id,name,category,followers_count'
            }
        });
        
        const pages = pagesResponse.data.data || [];
        console.log(`✅ ${pages.length} página(s) encontrada(s):`);
        pages.forEach((page, index) => {
            console.log(`  ${index + 1}. ${page.name} (${page.id}) - ${page.category}`);
        });
        
        // Passo 4: Testar API local
        console.log('\n🧪 Passo 4: Testando API local /api/meta/accounts...');
        try {
            const localResponse = await axios.post('http://localhost:3000/api/meta/accounts', {
                access_token: access_token
            });
            
            console.log('✅ API local funcionando!');
            console.log('Resposta:', {
                adAccounts: localResponse.data.adAccounts?.length || 0,
                pages: localResponse.data.pages?.length || 0,
                total: localResponse.data.total
            });
        } catch (localError) {
            console.error('❌ Erro na API local:', localError.response?.data || localError.message);
        }
        
        // Resumo
        console.log('\n📋 Resumo do teste:');
        console.log(`- Token: ✅ Obtido com sucesso`);
        console.log(`- Contas de anúncios: ✅ ${adAccounts.length} encontrada(s)`);
        console.log(`- Páginas: ✅ ${pages.length} encontrada(s)`);
        console.log(`- API local: Testada`);
        
        if (adAccounts.length > 0) {
            console.log('\n🎉 Fluxo completo funcionando! Você pode prosseguir com a seleção de contas.');
        } else {
            console.log('\n⚠️ Nenhuma conta de anúncios encontrada. Verifique as permissões do seu app Meta.');
        }
        
    } catch (error) {
        console.error('❌ Erro no fluxo:', error.response?.data || error.message);
        
        if (error.response?.data?.error?.code === 100) {
            console.log('\n💡 O código de autorização expirou. Gere um novo código usando:');
            generateNewAuthUrl();
        }
    }
}

function generateNewAuthUrl() {
    const META_APP_ID = '925924588141447';
    const REDIRECT_URI = 'http://localhost:3000/api/meta/callback';
    
    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?` +
        `client_id=${META_APP_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=ads_management,ads_read,business_management,pages_read_engagement,pages_show_list&` +
        `response_type=code&` +
        `state=client_test-client-id_${Date.now()}`;
    
    console.log('\n🔗 Nova URL de autorização:');
    console.log(authUrl);
}

// Verificar se foi passado um código como argumento
const authCode = process.argv[2];

if (!authCode) {
    console.log('❌ Por favor, forneça o código de autorização como argumento:');
    console.log('node scripts/test-meta-complete-flow.js SEU_CODIGO_AQUI');
    console.log('\nPara obter um novo código:');
    generateNewAuthUrl();
} else {
    testCompleteMetaFlow(authCode).catch(console.error);
}