const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testFrontendApiAccess() {
  console.log('🧪 Testando acesso à API do frontend...\n');

  try {
    // 1. Testar se o servidor está rodando
    console.log('1. Testando se o servidor Next.js está rodando:');
    
    const serverUrls = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://flying-fox-bob.vercel.app'
    ];

    let workingUrl = null;
    
    for (const url of serverUrls) {
      try {
        console.log(`   Testando: ${url}`);
        const response = await fetch(`${url}/api/health`, { 
          method: 'GET',
          timeout: 5000 
        });
        
        if (response.ok) {
          console.log(`   ✅ Servidor funcionando: ${url}`);
          workingUrl = url;
          break;
        } else {
          console.log(`   ❌ Servidor retornou: ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Erro: ${error.message}`);
      }
    }

    if (!workingUrl) {
      console.log('\n❌ Nenhum servidor encontrado rodando');
      console.log('💡 Para testar, execute: pnpm dev');
      return;
    }

    // 2. Buscar dados para teste
    console.log('\n2. Buscando dados para teste:');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: client } = await supabase
      .from('clients')
      .select('id, name')
      .limit(1)
      .single();

    if (!client) {
      console.log('❌ Nenhum cliente encontrado para teste');
      return;
    }

    console.log(`✅ Cliente para teste: ${client.name} (${client.id})`);

    // 3. Testar API sem autenticação (deve dar 401)
    console.log('\n3. Testando API sem autenticação:');
    try {
      const response = await fetch(`${workingUrl}/api/feature-gate/campaign-limit?clientId=${client.id}`);
      console.log(`   Status: ${response.status}`);
      
      if (response.status === 401) {
        console.log('   ✅ Corretamente bloqueado (401 - não autorizado)');
      } else {
        const data = await response.json();
        console.log('   📋 Resposta:', data);
      }
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }

    // 4. Testar outras APIs relacionadas
    console.log('\n4. Testando outras APIs:');
    
    const apiEndpoints = [
      '/api/plan-limits',
      '/api/user/info',
      '/api/organizations'
    ];

    for (const endpoint of apiEndpoints) {
      try {
        console.log(`   Testando: ${endpoint}`);
        const response = await fetch(`${workingUrl}${endpoint}`);
        console.log(`      Status: ${response.status}`);
        
        if (response.status === 401) {
          console.log('      ✅ Corretamente protegido');
        } else if (response.ok) {
          console.log('      ⚠️ Acessível sem auth (pode ser normal)');
        } else {
          console.log(`      ❌ Erro: ${response.status}`);
        }
      } catch (error) {
        console.log(`      ❌ Erro: ${error.message}`);
      }
    }

    // 5. Instruções para teste manual
    console.log('\n📋 INSTRUÇÕES PARA TESTE MANUAL:');
    console.log(`1. Abra o navegador em: ${workingUrl}`);
    console.log('2. Faça login no sistema');
    console.log('3. Vá para um cliente específico');
    console.log('4. Abra o DevTools (F12)');
    console.log('5. Vá para a aba Console');
    console.log('6. Procure por logs do ConnectMetaButton e useCampaignLimit');
    console.log('7. Clique no botão "Conectar Meta Ads"');
    console.log('8. Verifique os logs para ver o que está acontecendo');

    console.log('\n🔍 LOGS ESPERADOS:');
    console.log('- "🔍 Checking campaign limit for client: [ID]"');
    console.log('- "📡 API Response status: 200"');
    console.log('- "✅ API Response data: { allowed: true, ... }"');
    console.log('- "🔍 ConnectMetaButton state: { allowed: true, ... }"');

    console.log('\n❓ SE O PROBLEMA PERSISTIR:');
    console.log('1. Verifique se há cache no navegador (Ctrl+Shift+R)');
    console.log('2. Verifique se o usuário está logado corretamente');
    console.log('3. Verifique se há erros de CORS');
    console.log('4. Verifique se a sessão não expirou');

  } catch (error) {
    console.error('❌ Erro durante teste:', error);
  }
}

testFrontendApiAccess();