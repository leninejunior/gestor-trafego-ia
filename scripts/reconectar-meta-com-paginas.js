const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function reconectarMetaComPaginas() {
  console.log('🔄 RECONEXÃO META: Limpando conexões antigas e reconectando\n');
  console.log('=' .repeat(60));

  try {
    // 1. Listar clientes
    console.log('\n1️⃣ Buscando clientes...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name')
      .order('created_at', { ascending: false })
      .limit(10);

    if (clientsError) {
      console.error('❌ Erro ao buscar clientes:', clientsError);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('⚠️  Nenhum cliente encontrado');
      return;
    }

    console.log(`✅ ${clients.length} cliente(s) encontrado(s):\n`);
    clients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.name} (ID: ${client.id})`);
    });

    // 2. Verificar conexões existentes
    console.log('\n2️⃣ Verificando conexões Meta existentes...');
    const { data: connections, error: connectionsError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .in('client_id', clients.map(c => c.id));

    if (connectionsError) {
      console.error('❌ Erro ao buscar conexões:', connectionsError);
    } else {
      console.log(`📊 ${connections?.length || 0} conexão(ões) encontrada(s)`);
      
      if (connections && connections.length > 0) {
        console.log('\n📋 Conexões existentes:');
        connections.forEach(conn => {
          const client = clients.find(c => c.id === conn.client_id);
          console.log(`   - Cliente: ${client?.name}`);
          console.log(`     Status: ${conn.status}`);
          console.log(`     Criada em: ${new Date(conn.created_at).toLocaleString('pt-BR')}`);
        });

        // Perguntar se quer limpar
        console.log('\n⚠️  ATENÇÃO: Existem conexões antigas.');
        console.log('   Recomendamos limpar e reconectar para garantir permissões corretas.');
        console.log('\n   Para limpar, execute:');
        console.log('   node scripts/limpar-e-reconectar-meta.js');
      }
    }

    // 3. Instruções para reconexão
    console.log('\n3️⃣ INSTRUÇÕES PARA RECONECTAR:\n');
    console.log('   1. Escolha um cliente da lista acima');
    console.log('   2. Acesse: http://localhost:3000/dashboard/clients');
    console.log('   3. Clique em "Conectar Meta Ads" no cliente desejado');
    console.log('   4. Autorize TODAS as permissões solicitadas, incluindo:');
    console.log('      ✓ Gerenciar anúncios');
    console.log('      ✓ Ler dados de anúncios');
    console.log('      ✓ Gerenciar negócios');
    console.log('      ✓ Acessar páginas (IMPORTANTE!)');
    console.log('   5. Selecione as contas e páginas desejadas\n');

    // 4. Verificar permissões necessárias
    console.log('4️⃣ PERMISSÕES NECESSÁRIAS:\n');
    const requiredScopes = [
      'ads_management',
      'ads_read', 
      'business_management',
      'pages_read_engagement',
      'pages_show_list'
    ];

    console.log('   As seguintes permissões devem ser concedidas:');
    requiredScopes.forEach(scope => {
      console.log(`   ✓ ${scope}`);
    });

    console.log('\n5️⃣ VERIFICAÇÃO DE CONFIGURAÇÃO:\n');
    
    // Verificar variáveis de ambiente
    const envVars = {
      'META_APP_ID': process.env.META_APP_ID,
      'META_APP_SECRET': process.env.META_APP_SECRET,
      'NEXT_PUBLIC_APP_URL': process.env.NEXT_PUBLIC_APP_URL
    };

    console.log('   Variáveis de ambiente:');
    Object.entries(envVars).forEach(([key, value]) => {
      const status = value ? '✅' : '❌';
      const display = value ? (key.includes('SECRET') ? '***' : value) : 'NÃO DEFINIDA';
      console.log(`   ${status} ${key}: ${display}`);
    });

    // 6. Link para abrir
    console.log('\n6️⃣ PRÓXIMO PASSO:\n');
    console.log('   Abra o dashboard em: http://localhost:3000/dashboard/clients');
    console.log('   E clique em "Conectar Meta Ads" no cliente desejado');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Verificação concluída\n');
}

reconectarMetaComPaginas();
