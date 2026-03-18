/**
 * Teste simples para verificar se a API de campanhas está funcionando
 * Usa a rota existente /api/google/test-campaigns
 */

require('dotenv').config();

async function testCampaignsAPI() {
  console.log('🔧 Testando API de campanhas Google Ads...\n');

  try {
    // Primeiro, vamos buscar a conexão ativa
    const fetch = require('node-fetch');
    const { createClient } = require('../src/lib/supabase/server.ts');
    const supabase = await createClient();

    const { data: connection, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('status', 'active')
      .single();

    if (connError || !connection) {
      console.error('❌ Nenhuma conexão ativa encontrada');
      return;
    }

    console.log('✅ Conexão encontrada:', {
      id: connection.id,
      customer_id: connection.customer_id,
      status: connection.status
    });

    // Testar a API de campanhas
    console.log('\n🔍 Testando /api/google/test-campaigns...');
    
    const response = await fetch(`http://localhost:3000/api/google/test-campaigns?connectionId=${connection.id}`, {
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
      console.log(`- Campanhas encontradas: ${data.campaignsCount || 0}`);
      
      if (data.campaigns && data.campaigns.length > 0) {
        console.log('- Primeira campanha:', {
          id: data.campaigns[0].id,
          name: data.campaigns[0].name,
          status: data.campaigns[0].status,
          impressions: data.campaigns[0].impressions,
          clicks: data.campaigns[0].clicks,
          cost: data.campaigns[0].cost
        });
      }
    } else {
      console.log('\n❌ ERRO NA API:');
      console.log('- Mensagem:', data.error || data.message);
      if (data.stack) {
        console.log('- Stack:', data.stack);
      }
    }

  } catch (error) {
    console.error('\n❌ ERRO GERAL:');
    console.error('Mensagem:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 O servidor não está rodando. Inicie com: npm run dev');
    }
  }
}

// Executar teste
testCampaignsAPI();