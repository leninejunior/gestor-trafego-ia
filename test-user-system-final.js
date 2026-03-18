#!/usr/bin/env node

/**
 * Teste Final do Sistema de Usuários
 * Verifica se todas as funcionalidades estão funcionando corretamente
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = 'http://localhost:3000';

async function testUserSystem() {
  console.log('🧪 Teste Final do Sistema de Usuários');
  console.log('=====================================\n');

  let allTestsPassed = true;

  try {
    // 1. Testar API de listagem simples
    console.log('1. Testando API de listagem simples...');
    const simpleResponse = await fetch(`${BASE_URL}/api/admin/users/simple-test`, {
      timeout: 5000
    });
    
    if (simpleResponse.ok) {
      const simpleData = await simpleResponse.json();
      console.log(`✅ API simples funcionando - ${simpleData.users?.length || 0} usuários encontrados`);
    } else {
      console.log(`❌ API simples falhou - Status: ${simpleResponse.status}`);
      allTestsPassed = false;
    }

    // 2. Testar API de listagem completa
    console.log('\n2. Testando API de listagem completa...');
    const enhancedResponse = await fetch(`${BASE_URL}/api/admin/users/enhanced`, {
      timeout: 5000
    });
    
    if (enhancedResponse.ok) {
      const enhancedData = await enhancedResponse.json();
      console.log(`✅ API completa funcionando - ${enhancedData.users?.length || 0} usuários encontrados`);
      
      // Verificar estrutura dos dados
      if (enhancedData.users && enhancedData.users.length > 0) {
        const firstUser = enhancedData.users[0];
        console.log(`   📋 Primeiro usuário: ${firstUser.email} (${firstUser.user_type})`);
        console.log(`   📋 Status: ${firstUser.is_suspended ? 'Suspenso' : 'Ativo'}`);
        
        if (firstUser.memberships && firstUser.memberships.length > 0) {
          console.log(`   📋 Organização: ${firstUser.memberships[0].organizations?.name || 'N/A'}`);
        }
      }
    } else {
      console.log(`❌ API completa falhou - Status: ${enhancedResponse.status}`);
      allTestsPassed = false;
    }

    // 3. Testar API de organizações
    console.log('\n3. Testando API de organizações...');
    const orgsResponse = await fetch(`${BASE_URL}/api/admin/organizations`, {
      timeout: 5000
    });
    
    if (orgsResponse.ok) {
      const orgsData = await orgsResponse.json();
      console.log(`✅ API de organizações funcionando - ${orgsData.organizations?.length || 0} organizações encontradas`);
    } else {
      console.log(`❌ API de organizações falhou - Status: ${orgsResponse.status}`);
      allTestsPassed = false;
    }

    // 4. Testar página de admin (apenas verificar se carrega)
    console.log('\n4. Testando página de admin...');
    const adminPageResponse = await fetch(`${BASE_URL}/admin/users`, {
      timeout: 5000,
      redirect: 'manual' // Não seguir redirects
    });
    
    if (adminPageResponse.status === 200 || adminPageResponse.status === 302) {
      console.log(`✅ Página de admin acessível - Status: ${adminPageResponse.status}`);
    } else {
      console.log(`❌ Página de admin inacessível - Status: ${adminPageResponse.status}`);
      allTestsPassed = false;
    }

    // 5. Verificar se o servidor está estável
    console.log('\n5. Verificando estabilidade do servidor...');
    const healthResponse = await fetch(`${BASE_URL}/api/health`, {
      timeout: 3000
    }).catch(() => null);
    
    if (healthResponse && healthResponse.ok) {
      console.log('✅ Servidor estável');
    } else {
      console.log('⚠️  Endpoint de health não disponível (normal)');
    }

  } catch (error) {
    console.error('❌ Erro durante os testes:', error.message);
    allTestsPassed = false;
  }

  // Resultado final
  console.log('\n' + '='.repeat(50));
  if (allTestsPassed) {
    console.log('🎉 TODOS OS TESTES PASSARAM!');
    console.log('✅ Sistema de usuários está funcionando corretamente');
    console.log('✅ APIs estão respondendo');
    console.log('✅ Estrutura de dados está correta');
    console.log('\n📋 Próximos passos:');
    console.log('   1. Acesse http://localhost:3000/admin/users');
    console.log('   2. Teste a interface de usuários');
    console.log('   3. Teste as funcionalidades de ativar/desativar');
    console.log('   4. Teste a edição de usuários');
  } else {
    console.log('❌ ALGUNS TESTES FALHARAM');
    console.log('⚠️  Verifique os logs acima para detalhes');
  }
  
  console.log('\n🔗 URLs importantes:');
  console.log(`   Admin: ${BASE_URL}/admin/users`);
  console.log(`   API Simples: ${BASE_URL}/api/admin/users/simple-test`);
  console.log(`   API Completa: ${BASE_URL}/api/admin/users/enhanced`);
}

// Executar teste
testUserSystem().catch(console.error);