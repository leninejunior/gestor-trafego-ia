const { createClient } = require('@supabase/supabase-js');

async function debugMetaConnections() {
    console.log('🔍 Debugando conexões Meta...\n');
    
    const supabaseUrl = 'https://doiogabdzybqxnyhktbv.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaW9nYWJkenlicXhueWhrdGJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg1ODcyOSwiZXhwIjoyMDc1NDM0NzI5fQ.HlJgXvaOLcAOvJa9iV2jNpAqx1du5Ge9-oBD9oYkXuw';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
        // 1. Verificar todas as conexões Meta
        console.log('📊 1. Verificando todas as conexões Meta...');
        const { data: allConnections, error: allError } = await supabase
            .from('client_meta_connections')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (allError) {
            console.error('❌ Erro ao buscar conexões:', allError);
            return;
        }
        
        console.log(`✅ Total de conexões encontradas: ${allConnections.length}`);
        
        if (allConnections.length > 0) {
            console.log('\n📋 Conexões encontradas:');
            allConnections.forEach((conn, index) => {
                console.log(`  ${index + 1}. Cliente: ${conn.client_id}`);
                console.log(`     - Conta Meta: ${conn.ad_account_id} (${conn.account_name})`);
                console.log(`     - Ativa: ${conn.is_active}`);
                console.log(`     - Criado em: ${conn.created_at}`);
                console.log(`     - Token válido: ${conn.access_token ? 'Sim' : 'Não'}`);
                console.log('');
            });
        }
        
        // 2. Verificar cliente específico
        const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77';
        console.log(`🎯 2. Verificando cliente específico: ${clientId}...`);
        
        const { data: clientConnections, error: clientError } = await supabase
            .from('client_meta_connections')
            .select('*')
            .eq('client_id', clientId);
        
        if (clientError) {
            console.error('❌ Erro ao buscar conexões do cliente:', clientError);
            return;
        }
        
        console.log(`✅ Conexões do cliente: ${clientConnections.length}`);
        
        if (clientConnections.length > 0) {
            console.log('\n📋 Detalhes das conexões do cliente:');
            clientConnections.forEach((conn, index) => {
                console.log(`  ${index + 1}. Conta: ${conn.account_name} (${conn.ad_account_id})`);
                console.log(`     - Ativa: ${conn.is_active}`);
                console.log(`     - Moeda: ${conn.currency}`);
                console.log(`     - Token: ${conn.access_token ? conn.access_token.substring(0, 20) + '...' : 'Não encontrado'}`);
                console.log('');
            });
        } else {
            console.log('⚠️ Nenhuma conexão encontrada para este cliente');
        }
        
        // 3. Verificar se o cliente existe
        console.log(`👤 3. Verificando se o cliente existe...`);
        const { data: client, error: clientExistsError } = await supabase
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single();
        
        if (clientExistsError) {
            console.error('❌ Erro ao verificar cliente:', clientExistsError);
        } else {
            console.log(`✅ Cliente encontrado: ${client.name}`);
        }
        
        // 4. Testar API de campanhas
        if (clientConnections.length > 0) {
            console.log(`🧪 4. Testando busca de campanhas...`);
            
            const connection = clientConnections[0];
            const url = `http://localhost:3000/api/meta/campaigns?clientId=${clientId}&adAccountId=${connection.ad_account_id}`;
            
            try {
                const response = await fetch(url);
                const campaignsData = await response.json();
                
                console.log('📊 Resultado da API de campanhas:');
                console.log('Status:', response.status);
                console.log('Campanhas encontradas:', campaignsData.campaigns?.length || 0);
                console.log('É dados de teste?', campaignsData.isTestData);
                
                if (campaignsData.message) {
                    console.log('Mensagem:', campaignsData.message);
                }
                
                if (campaignsData.error) {
                    console.log('Erro:', campaignsData.error);
                }
                
            } catch (apiError) {
                console.error('❌ Erro ao testar API:', apiError.message);
            }
        }
        
    } catch (error) {
        console.error('💥 Erro geral:', error);
    }
}

debugMetaConnections().catch(console.error);