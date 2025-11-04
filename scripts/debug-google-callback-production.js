/**
 * Debug Google Callback Production Error
 * 
 * Investiga o erro "unexpected" no callback do Google OAuth em produção
 */

require('dotenv').config();

console.log('🔍 Investigando erro "unexpected" no callback Google OAuth...\n');

// Simular o que acontece no callback
async function debugCallbackFlow() {
  try {
    console.log('📋 1. Verificando variáveis de ambiente...');
    
    const requiredVars = {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
    };
    
    console.log('🔑 Variáveis encontradas:');
    Object.entries(requiredVars).forEach(([key, value]) => {
      console.log(`  - ${key}: ${value ? '✅ Configurada' : '❌ Ausente'}`);
    });
    
    console.log('\n📋 2. Testando conexão com Supabase...');
    
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      requiredVars.NEXT_PUBLIC_SUPABASE_URL,
      requiredVars.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Testar conexão básica
    const { data, error } = await supabase
      .from('google_ads_connections')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Erro na conexão Supabase:', error);
    } else {
      console.log('✅ Conexão Supabase funcionando');
    }
    
    console.log('\n📋 3. Verificando tabela oauth_states...');
    
    const { data: statesData, error: statesError } = await supabase
      .from('oauth_states')
      .select('count')
      .limit(1);
    
    if (statesError) {
      console.error('❌ Erro na tabela oauth_states:', statesError);
    } else {
      console.log('✅ Tabela oauth_states acessível');
    }
    
    console.log('\n📋 4. Testando troca de tokens com Google...');
    
    // Simular troca de tokens (sem código real)
    const testTokenExchange = async () => {
      try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            code: 'test_code_invalid',
            client_id: requiredVars.GOOGLE_CLIENT_ID,
            client_secret: requiredVars.GOOGLE_CLIENT_SECRET,
            redirect_uri: `${requiredVars.NEXT_PUBLIC_APP_URL}/api/google/callback`,
            grant_type: 'authorization_code',
          }),
        });
        
        const result = await response.json();
        
        if (response.ok) {
          console.log('✅ Endpoint de tokens Google acessível');
        } else {
          console.log('⚠️  Endpoint de tokens Google acessível (erro esperado com código inválido)');
          console.log('   Erro:', result.error);
        }
      } catch (error) {
        console.error('❌ Erro ao acessar endpoint de tokens:', error.message);
      }
    };
    
    await testTokenExchange();
    
    console.log('\n📋 5. Verificando estrutura da tabela google_ads_connections...');
    
    // Verificar se user_id é obrigatório
    const testInsert = {
      client_id: '00000000-0000-0000-0000-000000000000',
      customer_id: 'test-customer',
      refresh_token: 'test-token',
      status: 'active'
    };
    
    console.log('🧪 Testando inserção sem user_id...');
    const { data: insertData, error: insertError } = await supabase
      .from('google_ads_connections')
      .insert(testInsert)
      .select('id');
    
    if (insertError) {
      console.log('❌ Inserção falhou (esperado se user_id for obrigatório):', insertError.message);
      
      // Testar com user_id
      console.log('🧪 Testando inserção com user_id...');
      const testInsertWithUser = {
        ...testInsert,
        user_id: '00000000-0000-0000-0000-000000000000'
      };
      
      const { data: insertData2, error: insertError2 } = await supabase
        .from('google_ads_connections')
        .insert(testInsertWithUser)
        .select('id');
      
      if (insertError2) {
        console.log('❌ Inserção com user_id também falhou:', insertError2.message);
      } else {
        console.log('✅ Inserção com user_id funcionou');
        
        // Limpar teste
        if (insertData2 && insertData2[0]) {
          await supabase
            .from('google_ads_connections')
            .delete()
            .eq('id', insertData2[0].id);
          console.log('🧹 Dados de teste removidos');
        }
      }
    } else {
      console.log('✅ Inserção sem user_id funcionou');
      
      // Limpar teste
      if (insertData && insertData[0]) {
        await supabase
          .from('google_ads_connections')
          .delete()
          .eq('id', insertData[0].id);
        console.log('🧹 Dados de teste removidos');
      }
    }
    
    console.log('\n📋 POSSÍVEIS CAUSAS DO ERRO "UNEXPECTED":');
    console.log('1. Problema na validação do estado OAuth');
    console.log('2. Erro na troca de tokens com Google');
    console.log('3. Falha na inserção no banco (RLS, campos obrigatórios)');
    console.log('4. Erro no import do createServiceClient');
    console.log('5. Timeout ou erro de rede');
    
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('1. Verificar logs do Vercel para erro específico');
    console.log('2. Testar fluxo OAuth completo em desenvolvimento');
    console.log('3. Verificar se URI foi configurado no Google Cloud Console');
    
  } catch (error) {
    console.error('❌ Erro geral no debug:', error);
  }
}

// Executar debug
debugCallbackFlow();