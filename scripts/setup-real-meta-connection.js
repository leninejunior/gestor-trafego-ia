const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabase = createClient(
  'https://doiogabdzybqxnyhktbv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaW9nYWJkenlicXhueWhrdGJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg1ODcyOSwiZXhwIjoyMDc1NDM0NzI5fQ.Ej6Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'
);

// Token do Meta Ads
const META_ACCESS_TOKEN = 'EAAWfRZC9dzBYBPolqwPR8VykYXl8l5xiZCXGaca2XvPRqdcZAXznciMxllqzSjapeCmzTlCGTHlv0fY9tWid2U6tESDBIIINgEYmYD47Kz7zgbMvggcv9bvOZAucrPjqNVRF6wi4z3ZAcEVdBO83dgCxnmH65NDAQZAtINQJ3k2HRGtdEyAGJuxQElWEyT1iqcHfcxIh3o';

async function setupRealMetaConnection() {
  console.log('🚀 Configurando conexão REAL com Meta Ads...\n');

  try {
    // 1. Verificar se existe um cliente
    console.log('1️⃣ Verificando clientes existentes...');
    const { data: existingClients } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    let clientId;
    
    if (existingClients && existingClients.length > 0) {
      clientId = existingClients[0].id;
      console.log(`✅ Cliente encontrado: ${existingClients[0].name} (ID: ${clientId})`);
    } else {
      // Criar um cliente de teste
      console.log('📝 Criando cliente de teste...');
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert([{
          name: 'Cliente Meta Ads Real',
          email: 'cliente@metaads.com',
          phone: '(11) 99999-9999',
          organization_name: 'Empresa Meta Ads'
        }])
        .select()
        .single();

      if (clientError) {
        throw new Error(`Erro ao criar cliente: ${clientError.message}`);
      }

      clientId = newClient.id;
      console.log(`✅ Cliente criado: ${newClient.name} (ID: ${clientId})`);
    }

    // 2. Buscar contas Meta Ads disponíveis
    console.log('\n2️⃣ Buscando contas Meta Ads disponíveis...');
    const response = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?access_token=${META_ACCESS_TOKEN}&fields=id,name,account_status,currency`);
    const adAccountsData = await response.json();

    if (adAccountsData.error) {
      throw new Error(`Erro da Meta API: ${adAccountsData.error.message}`);
    }

    const activeAccounts = adAccountsData.data.filter(acc => acc.account_status === 1);
    console.log(`✅ ${activeAccounts.length} contas ativas encontradas:`);
    
    activeAccounts.forEach((acc, index) => {
      console.log(`   ${index + 1}. ${acc.name} (${acc.id}) - ${acc.currency || 'BRL'}`);
    });

    if (activeAccounts.length === 0) {
      throw new Error('Nenhuma conta Meta Ads ativa encontrada');
    }

    // 3. Usar a primeira conta ativa
    const selectedAccount = activeAccounts[0];
    console.log(`\n3️⃣ Selecionando conta: ${selectedAccount.name}`);

    // 4. Verificar se já existe conexão
    const { data: existingConnection } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', clientId)
      .eq('ad_account_id', selectedAccount.id)
      .single();

    if (existingConnection) {
      console.log('⚠️ Conexão já existe, atualizando...');
      
      const { error: updateError } = await supabase
        .from('client_meta_connections')
        .update({
          access_token: META_ACCESS_TOKEN,
          is_active: true,
          account_name: selectedAccount.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConnection.id);

      if (updateError) {
        throw new Error(`Erro ao atualizar conexão: ${updateError.message}`);
      }

      console.log('✅ Conexão atualizada com sucesso!');
    } else {
      console.log('📝 Criando nova conexão...');
      
      const { error: connectionError } = await supabase
        .from('client_meta_connections')
        .insert([{
          client_id: clientId,
          ad_account_id: selectedAccount.id,
          account_name: selectedAccount.name,
          access_token: META_ACCESS_TOKEN,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (connectionError) {
        throw new Error(`Erro ao criar conexão: ${connectionError.message}`);
      }

      console.log('✅ Conexão criada com sucesso!');
    }

    // 5. Testar busca de campanhas
    console.log('\n4️⃣ Testando busca de campanhas...');
    const campaignsResponse = await fetch(`https://graph.facebook.com/v21.0/${selectedAccount.id}/campaigns?access_token=${META_ACCESS_TOKEN}&fields=id,name,status,objective&limit=5`);
    const campaignsData = await campaignsResponse.json();

    if (campaignsData.error) {
      throw new Error(`Erro ao buscar campanhas: ${campaignsData.error.message}`);
    }

    console.log(`✅ ${campaignsData.data.length} campanhas encontradas:`);
    campaignsData.data.forEach((campaign, index) => {
      console.log(`   ${index + 1}. ${campaign.name} (${campaign.status})`);
    });

    console.log('\n🎉 CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('\n📋 Resumo:');
    console.log(`   👤 Cliente ID: ${clientId}`);
    console.log(`   🔗 Conta Meta: ${selectedAccount.name}`);
    console.log(`   📊 Campanhas: ${campaignsData.data.length} encontradas`);
    console.log('\n🚀 Agora você pode acessar o dashboard e ver as campanhas REAIS!');
    console.log(`   URL: http://localhost:3000/dashboard/campaigns`);

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    process.exit(1);
  }
}

// Executar o script
setupRealMetaConnection();