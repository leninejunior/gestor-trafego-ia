#!/usr/bin/env node

/**
 * Script para criar a tabela de auditoria diretamente
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://doiogabdzybqxnyhktbv.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaW9nYWJkenlicXhueWhrdGJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg1ODcyOSwiZXhwIjoyMDc1NDM0NzI5fQ.HlJgXvaOLcAOvJa9iV2jNpAqx1du5Ge9-oBD9oYkXuw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAuditTableDirect() {
  try {
    console.log('🔧 Criando tabela subscription_audit_log...');

    // Tentar inserir um registro de teste primeiro para ver se a tabela existe
    const testId = '00000000-0000-0000-0000-000000000001';
    
    const { data, error } = await supabase
      .from('subscription_audit_log')
      .insert({
        id: testId,
        subscription_id: testId,
        organization_id: testId,
        admin_user_id: testId,
        action_type: 'test',
        reason: 'Teste de criação da tabela',
        notes: 'Registro de teste para verificar se a tabela existe',
        previous_data: { test: true },
        new_data: { test: true },
        effective_date: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    if (error) {
      if (error.message.includes('schema cache') || error.message.includes('does not exist')) {
        console.log('❌ Tabela não existe. Você precisa criar manualmente no Supabase.');
        console.log('');
        console.log('🔗 Acesse: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/editor');
        console.log('');
        console.log('📋 Execute este SQL no SQL Editor:');
        console.log('');
        console.log(`
-- Criar tabela de auditoria de assinaturas
CREATE TABLE IF NOT EXISTS subscription_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID,
  organization_id UUID,
  admin_user_id UUID,
  action_type TEXT CHECK (action_type IN (
    'plan_change',
    'manual_approval', 
    'billing_adjustment',
    'status_change'
  )),
  reason TEXT NOT NULL,
  notes TEXT,
  previous_data JSONB,
  new_data JSONB,
  effective_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_subscription_id 
  ON subscription_audit_log(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_organization_id 
  ON subscription_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_created_at 
  ON subscription_audit_log(created_at DESC);

-- Habilitar RLS
ALTER TABLE subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- Política para super admins
CREATE POLICY "subscription_audit_log_super_admin" 
ON subscription_audit_log FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM admin_users au 
    WHERE au.id = auth.uid() 
    AND au.role = 'super_admin'
  )
);
        `);
        console.log('');
        console.log('✅ Após executar o SQL, o sistema estará pronto!');
        
      } else {
        console.log('❌ Erro inesperado:', error.message);
      }
    } else {
      console.log('✅ Tabela existe! Removendo registro de teste...');
      
      // Remover o registro de teste
      await supabase
        .from('subscription_audit_log')
        .delete()
        .eq('id', testId);
        
      console.log('🧹 Registro de teste removido');
      console.log('🎉 Sistema pronto para uso!');
    }

    // Testar a nova API de organizações
    console.log('\n🧪 Testando nova API de organizações...');
    
    try {
      const response = await fetch('http://localhost:3000/api/admin/subscription-management/organizations');
      
      if (response.status === 401) {
        console.log('⚠️  API requer autenticação (esperado)');
      } else if (response.ok) {
        const data = await response.json();
        console.log('✅ Nova API funcionando:', data.success ? 'Sucesso' : 'Erro');
        if (data.organizations) {
          console.log(`   Organizações encontradas: ${data.organizations.length}`);
        }
      } else {
        console.log(`❌ API retornou status: ${response.status}`);
      }
    } catch (apiError) {
      console.log('❌ Erro ao testar API (servidor pode estar offline)');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

createAuditTableDirect();