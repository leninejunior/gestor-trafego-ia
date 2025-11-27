require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testCampaignsWithAuth() {
  console.log('🔧 Testando API de campanhas Google Ads (com autenticação)...');
  
  // 1. Primeiro, vamos obter um token de autenticação válido
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Buscar usuário de teste (lenine.engerne@gmail.com)
    const { data: users, error: usersError } = await supabase
      .from('auth.users')
      .select('id, email')
      .eq('email', 'lenine.engerne@gmail.com')
      .single();

    if (usersError || !users) {
      console.error('❌ Usuário de teste não encontrado:', usersError);
      return;
    }

    console.log('✅ Usuário encontrado:', users.email);

    // Criar um token JWT manualmente para teste
    // NOTA: Em produção, isso viria do frontend após login
    const { data: tokenData, error: tokenError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: users.email,
      options: {
        redirectTo: 'http://localhost:3000'
      }
    });

    if (tokenError) {
      console.error('❌ Erro ao gerar token:', tokenError);
      return;
    }

    console.log('✅ Token gerado para teste');

    // 2. Agora testar a API de campanhas
    const campaignsUrl = `http://localhost:3000/api/google/campaigns?clientId=19ec44b5-a2c8-4410-bbb2-433f049f45ef`;
    
    console.log('🔍 Testando /api/google/campaigns via fetch...');

    const response = await fetch(campaignsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.properties.access_token}`,
        'Cookie': `sb-access-token=${tokenData.properties.access_token}`
      }
    });

    console.log('📊 Status da resposta:', { 
      status: response.status, 
      ok: response.ok 
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCESSO - Campanhas encontradas:');
      console.log(`   Total: ${data.count || 0}`);
      
      if (data.campaigns && data.campaigns.length > 0) {
        data.campaigns.forEach((campaign, index) => {
          console.log(`\n📊 Campanha ${index + 1}:`);
          console.log(`   ID: ${campaign.id}`);
          console.log(`   Campaign ID (Google): ${campaign.campaign_id}`);
          console.log(`   Nome: ${campaign.campaign_name}`);
          console.log(`   Status: ${campaign.status}`);
          console.log(`   Orçamento: $${campaign.budget_amount}`);
          console.log(`   Moeda: ${campaign.budget_currency}`);
          console.log(`   Data início: ${campaign.start_date}`);
          console.log(`   Data fim: ${campaign.end_date}`);
          console.log(`   Conexão: ${campaign.connection?.customer_id} (${campaign.connection?.status})`);
          console.log(`   Data de criação: ${campaign.created_at}`);
          console.log(`   Data de atualização: ${campaign.updated_at}`);
        });
      }
    } else {
      console.log('❌ ERRO NA API:');
      console.log('- Mensagem:', data.message || 'Sem mensagem');
      console.log('- Detalhes:', data.details || 'Sem detalhes');
      console.log('- Erro:', data.error || 'Sem erro');
    }

  } catch (error) {
    console.error('💥 Erro geral:', error.message);
  }
}

testCampaignsWithAuth();