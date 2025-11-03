const axios = require('axios');

async function testClientPageAPIs() {
    console.log('🧪 Testando APIs da página do cliente...\n');
    
    const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77';
    const baseUrl = 'http://localhost:3000';
    
    try {
        // 1. Testar API de informações do usuário
        console.log('1. Testando API de informações do usuário...');
        try {
            const userResponse = await axios.get(`${baseUrl}/api/user/info`);
            console.log('✅ Usuário logado:', userResponse.data.email);
        } catch (userError) {
            console.log('❌ Usuário não logado:', userError.response?.status);
        }
        
        // 2. Testar API de clientes
        console.log('\n2. Testando API de clientes...');
        try {
            const clientsResponse = await axios.get(`${baseUrl}/api/clients`);
            console.log('✅ Clientes encontrados:', clientsResponse.data.length);
            
            const targetClient = clientsResponse.data.find(c => c.id === clientId);
            if (targetClient) {
                console.log('✅ Cliente alvo encontrado:', targetClient.name);
            } else {
                console.log('❌ Cliente alvo não encontrado na lista');
            }
        } catch (clientsError) {
            console.log('❌ Erro ao buscar clientes:', clientsError.response?.status);
        }
        
        // 3. Testar API de campanhas Meta
        console.log('\n3. Testando API de campanhas Meta...');
        try {
            const campaignsUrl = `${baseUrl}/api/meta/campaigns?clientId=${clientId}&adAccountId=act_3656912201189816`;
            const campaignsResponse = await axios.get(campaignsUrl);
            
            console.log('✅ API de campanhas funcionando');
            console.log('📊 Campanhas:', campaignsResponse.data.campaigns?.length || 0);
            console.log('🧪 Dados de teste?', campaignsResponse.data.isTestData);
            
            if (campaignsResponse.data.message) {
                console.log('💬 Mensagem:', campaignsResponse.data.message);
            }
        } catch (campaignsError) {
            console.log('❌ Erro na API de campanhas:', campaignsError.response?.status);
        }
        
        // 4. Testar página HTML diretamente
        console.log('\n4. Testando carregamento da página HTML...');
        try {
            const pageResponse = await axios.get(`${baseUrl}/dashboard/clients/${clientId}`);
            const html = pageResponse.data;
            
            console.log('✅ Página carregou com sucesso');
            console.log('📄 Tamanho do HTML:', html.length, 'caracteres');
            
            // Verificar se contém elementos relacionados ao Meta
            const hasMetaElements = html.includes('Meta') || html.includes('Facebook') || html.includes('BM Coan');
            console.log('🔍 Contém elementos Meta:', hasMetaElements);
            
            // Verificar se há erros JavaScript na página
            const hasJSErrors = html.includes('error') || html.includes('Error');
            console.log('⚠️ Possíveis erros JS:', hasJSErrors);
            
        } catch (pageError) {
            console.log('❌ Erro ao carregar página:', pageError.response?.status);
        }
        
        console.log('\n📋 Resumo:');
        console.log('- Para ver a página funcionando, acesse:');
        console.log(`  ${baseUrl}/dashboard/clients/${clientId}`);
        console.log('- Certifique-se de estar logado no sistema');
        console.log('- As conexões Meta devem aparecer na seção de integrações');
        
    } catch (error) {
        console.error('💥 Erro geral:', error.message);
    }
}

testClientPageAPIs().catch(console.error);