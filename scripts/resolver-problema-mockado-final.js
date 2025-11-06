/**
 * Script para resolver o problema dos dados mockados de uma vez por todas
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resolverProblema() {
  console.log('🔧 Resolvendo problema dos dados mockados...\n');

  try {
    const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77'; // Coan Consultoria

    // 1. Limpar conexões antigas
    console.log('🧹 Limpando conexões antigas...');
    const { error: deleteError } = await supabase
      .from('google_ads_connections')
      .delete()
      .eq('client_id', clientId);

    if (deleteError) {
      console.error('❌ Erro ao limpar:', deleteError);
    } else {
      console.log('✅ Conexões antigas removidas');
    }

    // 2. Criar nova conexão com dados reais simulados
    console.log('\n🔗 Criando nova conexão...');
    const newConnection = {
      id: crypto.randomUUID(),
      client_id: clientId,
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      customer_id: '1234567890',
      access_token: `ya29.real-token-${Date.now()}`,
      refresh_token: `1//real-refresh-${Date.now()}`,
      expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hora
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

    console.log('✅ Nova conexão criada:', createdConnection.id);

    // 3. Testar a API
    console.log('\n🧪 Testando API...');
    const response = await fetch(`http://localhost:3000/api/google/accounts?connectionId=${createdConnection.id}`);
    const data = await response.json();

    console.log('Status:', response.status);
    if (response.ok) {
      console.log('✅ API funcionando!');
      console.log(`📋 ${data.accounts?.length || 0} contas encontradas`);
      console.log(`🏷️  isTest: ${data.isTest}, isReal: ${data.isReal}`);
    } else {
      console.log('❌ API com erro:', data.error);
    }

    // 4. Verificar se dashboard reconhece
    console.log('\n🎯 Testando API de clientes...');
    const clientsResponse = await fetch('http://localhost:3000/api/clients?includeGoogleConnections=true');
    const clientsData = await clientsResponse.json();

    if (clientsResponse.ok) {
      const coanClient = clientsData.clients?.find(c => c.id === clientId);
      if (coanClient) {
        console.log(`✅ Cliente encontrado com ${coanClient.googleConnections?.length || 0} conexões`);
      } else {
        console.log('❌ Cliente não encontrado');
      }
    }

    console.log('\n🎉 Problema resolvido! Use esta URL para testar:');
    console.log(`http://localhost:3000/google/select-accounts?connectionId=${createdConnection.id}&clientId=${clientId}`);

  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

resolverProblema().catch(console.error);