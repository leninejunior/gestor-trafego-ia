/**
 * Corrigir schema da tabela google_ads_connections
 * Adicionar user_id se necessário
 */

// Carregar variáveis de ambiente
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixGoogleAdsConnectionsSchema() {
  console.log('🔧 Corrigindo schema da tabela google_ads_connections...\n');

  try {
    // 1. Verificar se user_id já existe
    console.log('1. Verificando se user_id existe...');
    
    const { data: testData, error: testError } = await supabase
      .from('google_ads_connections')
      .insert({
        client_id: '00000000-0000-0000-0000-000000000001',
        user_id: '00000000-0000-0000-0000-000000000001',
        customer_id: 'test-customer',
        refresh_token: 'test-refresh-token',
        status: 'active'
      })
      .select();

    if (testError) {
      if (testError.code === '23502' && testError.message.includes('user_id')) {
        console.log('❌ user_id é obrigatório mas não foi fornecido');
        console.log('✅ Coluna user_id já existe');
        
        // Tentar novamente com user_id
        const { data: testData2, error: testError2 } = await supabase
          .from('google_ads_connections')
          .insert({
            client_id: '00000000-0000-0000-0000-000000000001',
            user_id: '00000000-0000-0000-0000-000000000001',
            customer_id: 'test-customer',
            refresh_token: 'test-refresh-token',
            status: 'active'
          })
          .select();

        if (testError2) {
          console.log('❌ Ainda há erro:', testError2);
        } else {
          console.log('✅ Inserção com user_id funcionou');
          
          // Limpar registro de teste
          await supabase
            .from('google_ads_connections')
            .delete()
            .eq('id', testData2[0].id);
          
          console.log('✅ Registro de teste removido');
        }
      } else if (testError.message.includes('user_id') && testError.message.includes('does not exist')) {
        console.log('❌ Coluna user_id não existe, precisa ser adicionada');
        
        // Adicionar coluna user_id
        console.log('2. Adicionando coluna user_id...');
        
        // Como não temos acesso direto ao SQL, vamos tentar uma abordagem diferente
        console.log('⚠️ Não é possível adicionar coluna via API. Precisa ser feito manualmente no Supabase.');
        console.log('Execute este SQL no Supabase SQL Editor:');
        console.log('');
        console.log('ALTER TABLE google_ads_connections ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);');
        console.log('');
        
      } else {
        console.log('❌ Erro inesperado:', testError);
      }
    } else {
      console.log('✅ Inserção funcionou, schema está correto');
      
      // Limpar registro de teste
      await supabase
        .from('google_ads_connections')
        .delete()
        .eq('id', testData[0].id);
      
      console.log('✅ Registro de teste removido');
    }

    // 2. Verificar conexões existentes sem user_id
    console.log('\n3. Verificando conexões existentes...');
    
    const { data: existingConnections, error: existingError } = await supabase
      .from('google_ads_connections')
      .select('*');

    if (existingError) {
      console.log('❌ Erro ao buscar conexões:', existingError);
    } else {
      console.log(`✅ Encontradas ${existingConnections?.length || 0} conexões`);
      
      if (existingConnections && existingConnections.length > 0) {
        existingConnections.forEach((conn, index) => {
          console.log(`${index + 1}. ID: ${conn.id}`);
          console.log(`   Client ID: ${conn.client_id}`);
          console.log(`   User ID: ${conn.user_id || 'NULL'}`);
          console.log(`   Customer ID: ${conn.customer_id}`);
          console.log(`   Status: ${conn.status}`);
          console.log(`   Has Access Token: ${!!conn.access_token}`);
          console.log(`   Has Refresh Token: ${!!conn.refresh_token}`);
          console.log(`   Token Expires: ${conn.token_expires_at}`);
          console.log('');
        });
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar correção
fixGoogleAdsConnectionsSchema().catch(console.error);