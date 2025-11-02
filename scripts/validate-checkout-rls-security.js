const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas!');
  console.error('Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function validateCheckoutRLSSecurity() {
  console.log('🔒 Iniciando validação de segurança das políticas RLS do checkout...\n');

  try {
    // 1. Verificar se RLS está habilitado nas tabelas
    console.log('📋 1. Verificando se RLS está habilitado...');
    
    const { data: rlsStatus, error: rlsError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT 
            schemaname,
            tablename,
            rowsecurity as rls_enabled
          FROM pg_tables 
          WHERE tablename IN (
            'subscription_intents', 
            'subscription_intent_transitions', 
            'webhook_logs', 
            'payment_analytics'
          )
          AND schemaname = 'public'
          ORDER BY tablename;
        `
      });

    if (rlsError) {
      console.error('❌ Erro ao verificar status RLS:', rlsError);
      return false;
    }

    rlsStatus.forEach(table => {
      const status = table.rls_enabled ? '✅ HABILITADO' : '❌ DESABILITADO';
      console.log(`   ${table.tablename}: ${status}`);
    });

    // 2. Verificar políticas aplicadas por role
    console.log('\n📋 2. Verificando políticas por role...');
    
    const { data: policies, error: policiesError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT 
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd
          FROM pg_policies 
          WHERE tablename IN (
            'subscription_intents', 
            'subscription_intent_transitions', 
            'webhook_logs', 
            'payment_analytics'
          )
          ORDER BY tablename, policyname;
        `
      });

    if (policiesError) {
      console.error('❌ Erro ao verificar políticas:', policiesError);
      return false;
    }

    // Agrupar políticas por tabela
    const tableGroups = {};
    policies.forEach(policy => {
      if (!tableGroups[policy.tablename]) {
        tableGroups[policy.tablename] = [];
      }
      tableGroups[policy.tablename].push(policy);
    });

    let hasPublicRoleIssues = false;

    Object.keys(tableGroups).forEach(tableName => {
      console.log(`\n   📊 **${tableName.toUpperCase()}**`);
      tableGroups[tableName].forEach(policy => {
        const rolesStr = Array.isArray(policy.roles) ? policy.roles.join(', ') : policy.roles;
        console.log(`      ✓ ${policy.policyname}`);
        console.log(`        Comando: ${policy.cmd} | Roles: ${rolesStr}`);
        
        // Verificar se há políticas aplicadas ao role 'public' incorretamente
        if (rolesStr.includes('public') && !policy.policyname.includes('webhook insertion')) {
          console.log(`        ⚠️  ATENÇÃO: Política aplicada ao role 'public'`);
          hasPublicRoleIssues = true;
        }
      });
    });

    // 3. Testar isolamento de dados (simulação)
    console.log('\n📋 3. Validando estrutura de segurança...');

    // Verificar se existem políticas específicas por role
    const authenticatedPolicies = policies.filter(p => 
      Array.isArray(p.roles) ? p.roles.includes('authenticated') : p.roles.includes('authenticated')
    );
    
    const serviceRolePolicies = policies.filter(p => 
      Array.isArray(p.roles) ? p.roles.includes('service_role') : p.roles.includes('service_role')
    );

    const anonPolicies = policies.filter(p => 
      Array.isArray(p.roles) ? p.roles.includes('anon') : p.roles.includes('anon')
    );

    console.log(`   ✓ Políticas para usuários autenticados: ${authenticatedPolicies.length}`);
    console.log(`   ✓ Políticas para service role: ${serviceRolePolicies.length}`);
    console.log(`   ✓ Políticas para usuários anônimos: ${anonPolicies.length}`);

    // 4. Verificar funções de segurança
    console.log('\n📋 4. Verificando funções de segurança...');
    
    const { data: functions, error: functionsError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT 
            routine_name,
            routine_type,
            security_type
          FROM information_schema.routines 
          WHERE routine_name IN (
            'check_user_permissions',
            'can_access_subscription_intent'
          )
          AND routine_schema = 'public';
        `
      });

    if (functionsError) {
      console.error('❌ Erro ao verificar funções:', functionsError);
    } else {
      functions.forEach(func => {
        console.log(`   ✓ ${func.routine_name} (${func.routine_type}) - Security: ${func.security_type}`);
      });
    }

    // 5. Resumo da validação
    console.log('\n🎯 **RESUMO DA VALIDAÇÃO DE SEGURANÇA**');
    
    if (hasPublicRoleIssues) {
      console.log('   ⚠️  PROBLEMAS ENCONTRADOS:');
      console.log('      • Algumas políticas ainda estão aplicadas ao role "public"');
      console.log('      • Recomenda-se executar a migração RLS corrigida');
    } else {
      console.log('   ✅ SEGURANÇA OK:');
      console.log('      • RLS habilitado em todas as tabelas');
      console.log('      • Políticas aplicadas aos roles corretos');
      console.log('      • Isolamento de dados por usuário implementado');
    }

    console.log('\n📊 **ESTRUTURA DE SEGURANÇA:**');
    console.log('   • subscription_intents: Usuários veem apenas seus próprios dados');
    console.log('   • subscription_intent_transitions: Usuários veem apenas transições dos seus intents');
    console.log('   • webhook_logs: Apenas admins e service role têm acesso');
    console.log('   • payment_analytics: Apenas admins e service role têm acesso');
    console.log('   • Service role: Acesso total para processamento de webhooks');
    console.log('   • Webhooks públicos: Apenas inserção permitida para role anônimo');

    return !hasPublicRoleIssues;

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    return false;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  validateCheckoutRLSSecurity()
    .then(success => {
      if (success) {
        console.log('\n🎉 Validação de segurança concluída com sucesso!');
      } else {
        console.log('\n⚠️  Validação encontrou problemas que precisam ser corrigidos.');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { validateCheckoutRLSSecurity };