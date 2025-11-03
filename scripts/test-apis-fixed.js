#!/usr/bin/env node

/**
 * Teste das APIs corrigidas
 */

async function testAPIsFixed() {
  try {
    console.log('🧪 Testando APIs corrigidas...');

    const baseUrl = 'http://localhost:3000';

    // 1. Testar API de organizações para subscription management
    console.log('\n1️⃣ Testando API de organizações (subscription management)...');
    try {
      const response = await fetch(`${baseUrl}/api/admin/subscription-management/organizations`);
      console.log(`   Status: ${response.status}`);
      
      if (response.status === 401) {
        console.log('✅ API protegida por autenticação (esperado)');
      } else if (response.ok) {
        const data = await response.json();
        console.log('✅ API funcionando:', data.success ? 'Sucesso' : 'Erro');
        if (data.organizations) {
          console.log(`   Organizações encontradas: ${data.organizations.length}`);
        }
      } else {
        const errorData = await response.text();
        console.log('❌ Erro na API:', response.status, errorData);
      }
    } catch (error) {
      console.log('❌ Erro de conexão:', error.message);
    }

    // 2. Testar API de audit history
    console.log('\n2️⃣ Testando API de audit history...');
    try {
      const response = await fetch(`${baseUrl}/api/admin/subscriptions/audit-history?limit=10`);
      console.log(`   Status: ${response.status}`);
      
      if (response.status === 401) {
        console.log('✅ API protegida por autenticação (esperado)');
      } else if (response.ok) {
        const data = await response.json();
        console.log('✅ API funcionando:', data.success ? 'Sucesso' : 'Erro');
        if (data.message) {
          console.log(`   Mensagem: ${data.message}`);
        }
      } else {
        const errorData = await response.text();
        console.log('❌ Erro na API:', response.status, errorData);
      }
    } catch (error) {
      console.log('❌ Erro de conexão:', error.message);
    }

    // 3. Testar API de manual adjustment (POST)
    console.log('\n3️⃣ Testando API de manual adjustment...');
    try {
      const response = await fetch(`${baseUrl}/api/admin/subscriptions/manual-adjustment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId: 'test-id',
          adjustmentType: 'plan_change',
          reason: 'Teste'
        })
      });
      console.log(`   Status: ${response.status}`);
      
      if (response.status === 401) {
        console.log('✅ API protegida por autenticação (esperado)');
      } else if (response.status === 400) {
        console.log('✅ API validando dados (esperado para dados de teste)');
      } else if (response.ok) {
        console.log('✅ API funcionando');
      } else {
        const errorData = await response.text();
        console.log('⚠️  Status inesperado:', response.status, errorData);
      }
    } catch (error) {
      console.log('❌ Erro de conexão:', error.message);
    }

    // 4. Testar página do gerenciamento manual
    console.log('\n4️⃣ Testando página do gerenciamento manual...');
    try {
      const response = await fetch(`${baseUrl}/admin/subscription-management`);
      console.log(`   Status: ${response.status}`);
      
      if (response.ok) {
        console.log('✅ Página acessível');
      } else {
        console.log('❌ Erro na página:', response.statusText);
      }
    } catch (error) {
      console.log('❌ Erro de conexão:', error.message);
    }

    console.log('\n📊 RESUMO DAS CORREÇÕES:');
    console.log('========================');
    console.log('');
    console.log('✅ CORREÇÕES APLICADAS:');
    console.log('   - API audit-history: Agora funciona sem tabela de auditoria');
    console.log('   - API manual-adjustment: Não falha se tabela de auditoria não existir');
    console.log('   - API organizations: Nova API específica para subscription management');
    console.log('   - Tratamento de erros melhorado');
    console.log('');
    console.log('🎯 RESULTADO ESPERADO:');
    console.log('   - Todas as APIs devem retornar 401 (não autenticado) ou 200 (sucesso)');
    console.log('   - Não deve mais haver erros 500');
    console.log('   - Interface deve carregar sem erros');
    console.log('');
    console.log('🚀 PRÓXIMOS PASSOS:');
    console.log('   1. Faça login como admin');
    console.log('   2. Acesse: Admin → Gerenciamento Manual');
    console.log('   3. Verifique se as organizações aparecem');
    console.log('   4. Crie a tabela de auditoria quando quiser o histórico completo');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testAPIsFixed();