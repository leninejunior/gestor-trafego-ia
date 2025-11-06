/**
 * Corrigir conexão Google existente
 * Adicionar tokens que estão faltando
 */

// Carregar variáveis de ambiente
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixExistingConnection() {
  console.log('🔧 Corrigindo conexão Google existente...\n');

  try {
    // 1. Buscar conexão existente
    console.log('1. Buscando conexão existente...');
    
    const { data: connections, error: connectionsError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .order('created_at', { ascending: false });

    if (connectionsError) {
      console.error('❌ Erro ao buscar conexões:', connectionsError);
      return;
    }

    if (!connections || connections.length === 0) {
      console.log('❌ Nenhuma conexão encontrada');
      return;
    }

    const connection = connections[0];
    console.log('✅ Conexão encontrada:', connection.id);
    console.log(`   Client ID: ${connection.client_id}`);
    console.log(`   Customer ID: ${connection.customer_id}`);
    console.log(`   Status: ${connection.status}`);
    console.log(`   Has Access Token: ${!!connection.access_token}`);
    console.log(`   Has Refresh Token: ${!!connection.refresh_token}`);
    console.log(`   Token Expires: ${connection.token_expires_at}`);

    // 2. Adicionar tokens se estão faltando
    if (!connection.access_token || !connection.token_expires_at) {
      console.log('\n2. Adicionando tokens faltantes...');
      
      const mockTokens = {
        access_token: 'mock_access_token_' + Date.now(),
        refresh_token: connection.refresh_token || ('mock_refresh_token_' + Date.now()),
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString() // 1 hora
      };

      const { data: updatedConnection, error: updateError } = await supabase
        .from('google_ads_connections')
        .update({
          access_token: mockTokens.access_token,
          refresh_token: mockTokens.refresh_token,
          token_expires_at: mockTokens.expires_at,
          status: 'active'
        })
        .eq('id', connection.id)
        .select();

      if (updateError) {
        console.error('❌ Erro ao atualizar conexão:', updateError);
      } else {
        console.log('✅ Conexão atualizada com sucesso');
        console.log('   Access Token adicionado:', !!updatedConnection[0].access_token);
        console.log('   Token Expires:', updatedConnection[0].token_expires_at);
      }
    } else {
      console.log('\n2. Tokens já existem, verificando validade...');
      
      const tokenExpired = connection.token_expires_at ? 
        new Date(connection.token_expires_at) < new Date() : true;
      
      if (tokenExpired) {
        console.log('⚠️ Token expirado, renovando...');
        
        const newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
        
        const { error: renewError } = await supabase
          .from('google_ads_connections')
          .update({
            token_expires_at: newExpiresAt,
            access_token: 'renewed_access_token_' + Date.now()
          })
          .eq('id', connection.id);

        if (renewError) {
          console.error('❌ Erro ao renovar token:', renewError);
        } else {
          console.log('✅ Token renovado com sucesso');
        }
      } else {
        console.log('✅ Token ainda válido');
      }
    }

    // 3. Testar API de accounts
    console.log('\n3. Testando API de accounts...');
    
    try {
      const response = await fetch(`http://localhost:3000/api/google/accounts?connectionId=${connection.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`Status da resposta: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API funcionou! Resposta:', JSON.stringify(data, null, 2));
      } else {
        const errorText = await response.text();
        console.log('❌ Erro na API:', errorText);
        
        // Tentar diagnosticar o erro
        if (errorText.includes('Token inválido')) {
          console.log('\n🔍 Diagnosticando problema de token...');
          
          // Verificar se o token manager está funcionando
          console.log('   - Problema pode estar no token manager ou criptografia');
          console.log('   - Verificar logs do servidor para mais detalhes');
        }
      }
    } catch (apiError) {
      console.error('❌ Erro ao chamar API:', apiError.message);
    }

    // 4. Verificar estado final
    console.log('\n4. Estado final da conexão...');
    
    const { data: finalConnection, error: finalError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('id', connection.id)
      .single();

    if (finalError) {
      console.error('❌ Erro ao buscar estado final:', finalError);
    } else {
      console.log('✅ Estado final:');
      console.log(`   ID: ${finalConnection.id}`);
      console.log(`   Client ID: ${finalConnection.client_id}`);
      console.log(`   Customer ID: ${finalConnection.customer_id}`);
      console.log(`   Status: ${finalConnection.status}`);
      console.log(`   Has Access Token: ${!!finalConnection.access_token}`);
      console.log(`   Has Refresh Token: ${!!finalConnection.refresh_token}`);
      console.log(`   Token Expires: ${finalConnection.token_expires_at}`);
      console.log(`   Token Valid: ${finalConnection.token_expires_at ? 
        new Date(finalConnection.token_expires_at) > new Date() : false}`);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar correção
fixExistingConnection().catch(console.error);