#!/usr/bin/env node

/**
 * Script para testar o sistema de gerenciamento manual de assinaturas
 */

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://doiogabdzybqxnyhktbv.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaW9nYWJkenlicXhueWhrdGJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg1ODcyOSwiZXhwIjoyMDc1NDM0NzI5fQ.HlJgXvaOLcAOvJa9iV2jNpAqx1du5Ge9-oBD9oYkXuw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSubscriptionManagement() {
  try {
    console.log('🧪 Testando sistema de gerenciamento manual de assinaturas...');

    // 1. Verificar se a tabela subscription_audit_log existe
    console.log('\n1️⃣ Verificando tabela subscription_audit_log...');
    
    const { data: auditTest, error: auditError } = await supabase
      .from('subscription_audit_log')
      .select('*')
      .limit(1);

    if (auditError) {
      console.log('❌ Tabela subscription_audit_log não existe ou não acessível');
      console.log('   Erro:', auditError.message);
      
      // Tentar criar a tabela básica
      console.log('🔧 Tentando criar tabela básica...');
      
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS subscription_audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          subscription_id UUID,
          organization_id UUID,
          admin_user_id UUID,
          action_type TEXT,
          reason TEXT,
          notes TEXT,
          previous_data JSONB,
          new_data JSONB,
          effective_date TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      
      // Como não temos RPC, vamos apenas informar
      console.log('📋 SQL necessário:');
      console.log(createTableSQL);
      
    } else {
      console.log('✅ Tabela subscription_audit_log existe e acessível');
      console.log(`   Registros encontrados: ${auditTest?.length || 0}`);
    }

    // 2. Verificar organizações
    console.log('\n2️⃣ Verificando organizações...');
    
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        subscriptions (
          id,
          status,
          plan_id,
          billing_cycle,
          subscription_plans (
            id,
            name,
            monthly_price,
            annual_price
          )
        )
      `)
      .limit(5);

    if (orgError) {
      console.log('❌ Erro ao buscar organizações:', orgError.message);
    } else {
      console.log(`✅ Encontradas ${organizations?.length || 0} organizações`);
      
      if (organizations && organizations.length > 0) {
        organizations.forEach((org, index) => {
          console.log(`   ${index + 1}. ${org.name}`);
          if (org.subscriptions && org.subscriptions.length > 0) {
            const sub = org.subscriptions[0];
            console.log(`      - Assinatura: ${sub.status}`);
            if (sub.subscription_plans) {
              console.log(`      - Plano: ${sub.subscription_plans.name}`);
            }
          } else {
            console.log('      - Sem assinatura');
          }
        });
      }
    }

    // 3. Verificar planos disponíveis
    console.log('\n3️⃣ Verificando planos disponíveis...');
    
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true);

    if (plansError) {
      console.log('❌ Erro ao buscar planos:', plansError.message);
    } else {
      console.log(`✅ Encontrados ${plans?.length || 0} planos ativos`);
      
      if (plans && plans.length > 0) {
        plans.forEach((plan, index) => {
          console.log(`   ${index + 1}. ${plan.name} - R$ ${plan.monthly_price}/mês`);
        });
      }
    }

    // 4. Testar APIs do sistema
    console.log('\n4️⃣ Testando APIs do sistema...');
    
    // Testar API de organizações
    try {
      const response = await fetch('http://localhost:3000/api/admin/organizations');
      if (response.ok) {
        console.log('✅ API /api/admin/organizations acessível');
      } else {
        console.log(`⚠️  API /api/admin/organizations retornou: ${response.status}`);
      }
    } catch (apiError) {
      console.log('❌ Erro ao testar API (servidor pode estar offline)');
    }

    // 5. Verificar estrutura necessária
    console.log('\n5️⃣ Verificando estrutura necessária...');
    
    const requiredTables = [
      'organizations',
      'subscriptions', 
      'subscription_plans',
      'subscription_audit_log'
    ];

    for (const table of requiredTables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ Tabela ${table}: ${error.message}`);
      } else {
        console.log(`✅ Tabela ${table}: OK`);
      }
    }

    // 6. Status geral
    console.log('\n📊 Status do Sistema de Gerenciamento Manual:');
    
    const hasOrganizations = organizations && organizations.length > 0;
    const hasPlans = plans && plans.length > 0;
    const hasAuditTable = !auditError;
    
    if (hasOrganizations && hasPlans && hasAuditTable) {
      console.log('🎉 Sistema PRONTO para uso!');
      console.log('');
      console.log('✅ Funcionalidades disponíveis:');
      console.log('   - Mudança de planos');
      console.log('   - Aprovação manual');
      console.log('   - Ajustes de cobrança');
      console.log('   - Mudança de status');
      console.log('   - Histórico de auditoria');
      console.log('');
      console.log('🚀 Para acessar: http://localhost:3000/admin/subscription-management');
      
    } else {
      console.log('⚠️  Sistema PARCIALMENTE pronto');
      console.log('');
      console.log('❌ Problemas encontrados:');
      if (!hasOrganizations) console.log('   - Nenhuma organização encontrada');
      if (!hasPlans) console.log('   - Nenhum plano ativo encontrado');
      if (!hasAuditTable) console.log('   - Tabela de auditoria não acessível');
      console.log('');
      console.log('🔧 Execute os scripts de setup necessários');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste
if (require.main === module) {
  testSubscriptionManagement()
    .then(() => {
      console.log('\n✅ Teste concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Teste falhou:', error);
      process.exit(1);
    });
}

module.exports = { testSubscriptionManagement };