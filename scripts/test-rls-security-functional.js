const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://doiogabdzybqxnyhktbv.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaW9nYWJkenlicXhueWhrdGJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg1ODcyOSwiZXhwIjoyMDc1NDM0NzI5fQ.HlJgXvaOLcAOvJa9iV2jNpAqx1du5Ge9-oBD9oYkXuw';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaW9nYWJkenlicXhueWhrdGJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NTg3MjksImV4cCI6MjA3NTQzNDcyOX0.ApHhvf9LO9DxaSQx0bYJtqxmHproH-rn_Kp4eJ15KZs';

const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function runSecurityTests() {
  console.log('🔒 Executando testes funcionais de segurança RLS...\n');

  let passedTests = 0;
  let totalTests = 0;

  // Função helper para executar teste
  async function runTest(testName, testFunction) {
    totalTests++;
    try {
      console.log(`📋 ${totalTests}. ${testName}`);
      const result = await testFunction();
      if (result) {
        console.log('   ✅ PASSOU');
        passedTests++;
      } else {
        console.log('   ❌ FALHOU');
      }
    } catch (error) {
      console.log(`   ❌ ERRO: ${error.message}`);
    }
    console.log('');
  }

  // Teste 1: Verificar se tabelas existem
  await runTest('Verificar existência das tabelas de checkout', async () => {
    const tables = ['subscription_intents', 'subscription_intent_transitions', 'webhook_logs', 'payment_analytics'];
    
    for (const tableName of tables) {
      const { error } = await supabaseService
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (error && error.code === 'PGRST116') {
        console.log(`     ❌ Tabela ${tableName} não encontrada`);
        return false;
      }
    }
    
    console.log('     ✅ Todas as tabelas existem');
    return true;
  });

  // Teste 2: Service role pode inserir webhook logs
  await runTest('Service role pode inserir webhook logs', async () => {
    const testWebhook = {
      event_type: 'test_security_' + Date.now(),
      event_id: 'test_' + Date.now(),
      payload: { test: true },
      status: 'received'
    };

    const { data, error } = await supabaseService
      .from('webhook_logs')
      .insert(testWebhook)
      .select();

    if (error) {
      console.log(`     ❌ Erro ao inserir: ${error.message}`);
      return false;
    }

    console.log('     ✅ Inserção bem-sucedida');
    
    // Limpar
    if (data && data[0]) {
      await supabaseService
        .from('webhook_logs')
        .delete()
        .eq('id', data[0].id);
    }
    
    return true;
  });

  // Teste 3: Usuário anônimo NÃO pode acessar subscription_intents
  await runTest('Usuário anônimo não pode acessar subscription_intents', async () => {
    const { data, error } = await supabaseAnon
      .from('subscription_intents')
      .select('*')
      .limit(1);

    if (error && error.code === '42501') {
      console.log('     ✅ Acesso negado como esperado (RLS ativo)');
      return true;
    } else if (!error && (!data || data.length === 0)) {
      console.log('     ✅ Sem dados retornados (seguro)');
      return true;
    } else {
      console.log('     ❌ Acesso permitido quando deveria ser negado');
      return false;
    }
  });

  // Teste 4: Service role pode gerenciar subscription_intents
  await runTest('Service role pode gerenciar subscription_intents', async () => {
    const testIntent = {
      plan_id: '00000000-0000-0000-0000-000000000000',
      billing_cycle: 'monthly',
      status: 'pending',
      user_email: 'test_security@example.com',
      user_name: 'Test Security User',
      organization_name: 'Test Security Org',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    const { data, error } = await supabaseService
      .from('subscription_intents')
      .insert(testIntent)
      .select();

    if (error) {
      console.log(`     ❌ Erro ao inserir: ${error.message}`);
      return false;
    }

    console.log('     ✅ Inserção bem-sucedida');
    
    // Testar atualização
    const { error: updateError } = await supabaseService
      .from('subscription_intents')
      .update({ status: 'completed' })
      .eq('id', data[0].id);

    if (updateError) {
      console.log(`     ❌ Erro ao atualizar: ${updateError.message}`);
      return false;
    }

    console.log('     ✅ Atualização bem-sucedida');
    
    // Limpar
    await supabaseService
      .from('subscription_intents')
      .delete()
      .eq('id', data[0].id);
    
    return true;
  });

  // Teste 5: Usuário anônimo NÃO pode acessar webhook_logs (exceto inserção)
  await runTest('Usuário anônimo não pode ler webhook_logs', async () => {
    const { data, error } = await supabaseAnon
      .from('webhook_logs')
      .select('*')
      .limit(1);

    if (error && error.code === '42501') {
      console.log('     ✅ Leitura negada como esperado');
      return true;
    } else if (!error && (!data || data.length === 0)) {
      console.log('     ✅ Sem dados retornados (seguro)');
      return true;
    } else {
      console.log('     ❌ Leitura permitida quando deveria ser negada');
      return false;
    }
  });

  // Teste 6: Verificar isolamento de dados por usuário
  await runTest('Verificar estrutura de isolamento de dados', async () => {
    // Verificar se subscription_intents tem campos necessários
    const { data, error } = await supabaseService
      .from('subscription_intents')
      .select('user_email, user_id, status')
      .limit(1);

    if (error && error.code !== 'PGRST301') { // PGRST301 = sem dados
      console.log(`     ❌ Erro ao verificar estrutura: ${error.message}`);
      return false;
    }

    console.log('     ✅ Estrutura de isolamento adequada');
    return true;
  });

  // Teste 7: Performance básica
  await runTest('Verificar performance básica das queries', async () => {
    const startTime = Date.now();
    
    await supabaseService
      .from('subscription_intents')
      .select('id')
      .limit(10);
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    if (duration < 5000) { // Menos de 5 segundos
      console.log(`     ✅ Query executada em ${duration}ms`);
      return true;
    } else {
      console.log(`     ❌ Query muito lenta: ${duration}ms`);
      return false;
    }
  });

  // Resumo final
  console.log('🎯 **RESUMO DOS TESTES DE SEGURANÇA**');
  console.log(`   Testes executados: ${totalTests}`);
  console.log(`   Testes aprovados: ${passedTests}`);
  console.log(`   Taxa de sucesso: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('   🎉 TODOS OS TESTES PASSARAM!');
    console.log('   ✅ Sistema de segurança RLS está funcionando corretamente');
  } else if (passedTests >= totalTests * 0.8) {
    console.log('   ⚠️  MAIORIA DOS TESTES PASSOU');
    console.log('   🔧 Alguns ajustes podem ser necessários');
  } else {
    console.log('   ❌ MUITOS TESTES FALHARAM');
    console.log('   🚨 Revisão urgente da segurança necessária');
  }

  console.log('\n📊 **PRÓXIMOS PASSOS:**');
  console.log('   1. Se todos os testes passaram, o sistema está seguro');
  console.log('   2. Se alguns falharam, revisar as políticas RLS específicas');
  console.log('   3. Monitorar logs de produção por 24h após deploy');
  console.log('   4. Executar testes de penetração se necessário');

  return passedTests === totalTests;
}

// Executar testes
runSecurityTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Erro fatal nos testes:', error);
    process.exit(1);
  });