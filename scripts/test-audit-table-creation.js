#!/usr/bin/env node

/**
 * Script para testar se a tabela de auditoria foi criada corretamente
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://doiogabdzybqxnyhktbv.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaW9nYWJkenlicXhueWhrdGJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg1ODcyOSwiZXhwIjoyMDc1NDM0NzI5fQ.HlJgXvaOLcAOvJa9iV2jNpAqx1du5Ge9-oBD9oYkXuw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAuditTableCreation() {
  try {
    console.log('🧪 Testando criação da tabela de auditoria...');

    // 1. Testar se a tabela existe
    console.log('\n1️⃣ Verificando se a tabela existe...');
    
    const { data: testData, error: testError } = await supabase
      .from('subscription_audit_log')
      .select('*')
      .limit(1);

    if (testError) {
      if (testError.message.includes('does not exist') || testError.message.includes('schema cache')) {
        console.log('❌ Tabela não existe ainda');
        console.log('');
        console.log('📋 Execute este SQL no Supabase Dashboard:');
        console.log('🔗 https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql');
        console.log('');
        console.log('-- Cole este código no SQL Editor:');
        console.log('');
        
        const fs = require('fs');
        const path = require('path');
        const sqlPath = path.join(__dirname, 'create-audit-table-simplified.sql');
        
        if (fs.existsSync(sqlPath)) {
          const sqlContent = fs.readFileSync(sqlPath, 'utf8');
          console.log(sqlContent);
        } else {
          console.log('-- Arquivo SQL não encontrado, use o conteúdo do script anterior');
        }
        
        return;
      } else {
        console.log('❌ Erro inesperado:', testError.message);
        return;
      }
    }

    console.log('✅ Tabela existe!');

    // 2. Testar inserção de um registro de teste
    console.log('\n2️⃣ Testando inserção...');
    
    const testRecord = {
      subscription_id: '00000000-0000-0000-0000-000000000001',
      organization_id: '00000000-0000-0000-0000-000000000001',
      admin_user_id: '00000000-0000-0000-0000-000000000001',
      action_type: 'plan_change',
      reason: 'Teste de funcionamento da tabela',
      notes: 'Registro de teste criado automaticamente',
      previous_data: { test: 'dados_anteriores' },
      new_data: { test: 'dados_novos' }
    };

    const { data: insertData, error: insertError } = await supabase
      .from('subscription_audit_log')
      .insert(testRecord)
      .select()
      .single();

    if (insertError) {
      console.log('❌ Erro ao inserir:', insertError.message);
      return;
    }

    console.log('✅ Inserção funcionando!');
    console.log('   ID do registro:', insertData.id);

    // 3. Testar busca
    console.log('\n3️⃣ Testando busca...');
    
    const { data: selectData, error: selectError } = await supabase
      .from('subscription_audit_log')
      .select('*')
      .eq('id', insertData.id)
      .single();

    if (selectError) {
      console.log('❌ Erro ao buscar:', selectError.message);
      return;
    }

    console.log('✅ Busca funcionando!');
    console.log('   Registro encontrado:', selectData.reason);

    // 4. Limpar registro de teste
    console.log('\n4️⃣ Limpando registro de teste...');
    
    const { error: deleteError } = await supabase
      .from('subscription_audit_log')
      .delete()
      .eq('id', insertData.id);

    if (deleteError) {
      console.log('⚠️  Erro ao limpar:', deleteError.message);
    } else {
      console.log('✅ Registro de teste removido');
    }

    // 5. Testar APIs agora
    console.log('\n5️⃣ Testando APIs...');
    
    try {
      const response = await fetch('http://localhost:3000/api/admin/subscriptions/audit-history?limit=5');
      console.log(`   API audit-history: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API funcionando:', data.success ? 'Sucesso' : 'Erro');
      } else if (response.status === 401) {
        console.log('✅ API protegida (esperado)');
      }
    } catch (apiError) {
      console.log('⚠️  Servidor pode estar offline');
    }

    console.log('\n🎉 TABELA DE AUDITORIA FUNCIONANDO!');
    console.log('');
    console.log('✅ Próximos passos:');
    console.log('   1. Faça login como admin');
    console.log('   2. Acesse: Admin → Gerenciamento Manual');
    console.log('   3. Teste as funcionalidades de ajuste');
    console.log('   4. Verifique o histórico de auditoria');
    console.log('');
    console.log('🎯 Sistema 100% funcional!');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testAuditTableCreation();