#!/usr/bin/env node

/**
 * Script para testar as APIs do gerenciamento manual
 */

async function testSubscriptionAPIs() {
  try {
    console.log('🧪 Testando APIs do gerenciamento manual...');

    const baseUrl = 'http://localhost:3000';

    // 1. Testar API de organizações (sem auth por enquanto)
    console.log('\n1️⃣ Testando API de organizações...');
    
    try {
      const response = await fetch(`${baseUrl}/api/admin/organizations`);
      console.log(`Status: ${response.status}`);
      
      if (response.status === 401) {
        console.log('⚠️  API requer autenticação (esperado)');
      } else if (response.ok) {
        const data = await response.json();
        console.log('✅ API funcionando:', data);
      } else {
        console.log('❌ Erro na API:', response.statusText);
      }
    } catch (error) {
      console.log('❌ Erro de conexão:', error.message);
    }

    // 2. Testar API de planos
    console.log('\n2️⃣ Testando API de planos...');
    
    try {
      const response = await fetch(`${baseUrl}/api/admin/plans`);
      console.log(`Status: ${response.status}`);
      
      if (response.status === 401) {
        console.log('⚠️  API requer autenticação (esperado)');
      } else if (response.ok) {
        const data = await response.json();
        console.log('✅ API funcionando:', data);
      } else {
        console.log('❌ Erro na API:', response.statusText);
      }
    } catch (error) {
      console.log('❌ Erro de conexão:', error.message);
    }

    // 3. Testar página do gerenciamento manual
    console.log('\n3️⃣ Testando página do gerenciamento manual...');
    
    try {
      const response = await fetch(`${baseUrl}/admin/subscription-management`);
      console.log(`Status: ${response.status}`);
      
      if (response.status === 401 || response.status === 403) {
        console.log('⚠️  Página requer autenticação (esperado)');
      } else if (response.ok) {
        console.log('✅ Página acessível');
      } else {
        console.log('❌ Erro na página:', response.statusText);
      }
    } catch (error) {
      console.log('❌ Erro de conexão:', error.message);
    }

    // 4. Verificar se o servidor está rodando
    console.log('\n4️⃣ Verificando servidor...');
    
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) {
        console.log('✅ Servidor Next.js rodando normalmente');
      } else {
        console.log(`⚠️  Servidor respondeu com status: ${response.status}`);
      }
    } catch (error) {
      console.log('❌ Servidor não está rodando ou não acessível');
    }

    console.log('\n📊 Resumo do Status:');
    console.log('');
    console.log('✅ Componentes implementados:');
    console.log('   - Página: /admin/subscription-management');
    console.log('   - Componente: SubscriptionManualManagement');
    console.log('   - API: /api/admin/subscriptions/manual-adjustment');
    console.log('   - API: /api/admin/subscriptions/audit-history');
    console.log('   - Documentação: docs/MANUAL_SUBSCRIPTION_MANAGEMENT.md');
    console.log('');
    console.log('⚠️  Pendências:');
    console.log('   - Criar tabela subscription_audit_log no Supabase');
    console.log('   - Configurar autenticação de admin');
    console.log('   - Testar funcionalidades end-to-end');
    console.log('');
    console.log('🚀 Para usar:');
    console.log('   1. Execute o SQL no Supabase Dashboard');
    console.log('   2. Faça login como admin');
    console.log('   3. Acesse: http://localhost:3000/admin/subscription-management');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testSubscriptionAPIs();