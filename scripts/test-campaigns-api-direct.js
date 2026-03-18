#!/usr/bin/env node

/**
 * Teste direto da API de campanhas sem dependências do Next.js
 * Usa fetch direto para testar o endpoint
 */

require('dotenv').config();

async function testCampaignsAPIDirect() {
  console.log('🔧 Testando API de campanhas Google Ads (direto)...');

  try {
    // Primeiro, vamos buscar a conexão ativa diretamente do Supabase
    const { createClient } = require('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: connection, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('status', 'active')
      .single();

    if (connError || !connection) {
      console.error('❌ Nenhuma conexão ativa encontrada');
      console.error('Erro:', connError);
      return;
    }

    console.log('✅ Conexão encontrada:', {
      id: connection.id,
      customer_id: connection.customer_id,
      status: connection.status
    });

    // Agora vamos testar a API de campanhas via fetch direto
    console.log('\n🔍 Testando /api/google/campaigns via fetch...');
    
    // Para testar a API, precisamos de um clientId válido
    // Vamos usar o clientId da conexão que encontramos
    const response = await fetch(`http://localhost:3000/api/google/campaigns?clientId=${connection.client_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    console.log('\n📊 Status da resposta:', {
      status: response.status,
      ok: response.ok
    });

    if (response.ok) {
      console.log('\n✅ SUCESSO!');
      console.log(`- Campanhas encontradas: ${data.campaigns?.length || 0}`);
      console.log(`- Count retornado: ${data.count || 0}`);
      
      if (data.campaigns && data.campaigns.length > 0) {
        console.log('- Primeira campanha:', {
          id: data.campaigns[0].id,
          name: data.campaigns[0].campaign_name,
          status: data.campaigns[0].status,
          created_at: data.campaigns[0].created_at
        });
      }
    } else {
      console.log('\n❌ ERRO NA API:');
      console.log('- Mensagem:', data.error || data.message);
      if (data.details) {
        console.log('- Detalhes:', data.details);
      }
    }

  } catch (error) {
    console.error('\n❌ ERRO GERAL:');
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 O servidor não está rodando. Inicie com: npm run dev');
    }
  }
}

// Executar teste
testCampaignsAPIDirect();