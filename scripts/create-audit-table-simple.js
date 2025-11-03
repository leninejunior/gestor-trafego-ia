#!/usr/bin/env node

/**
 * Script simples para criar a tabela de auditoria
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://doiogabdzybqxnyhktbv.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaW9nYWJkenlicXhueWhrdGJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg1ODcyOSwiZXhwIjoyMDc1NDM0NzI5fQ.HlJgXvaOLcAOvJa9iV2jNpAqx1du5Ge9-oBD9oYkXuw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAuditTable() {
  try {
    console.log('🔧 Criando tabela subscription_audit_log...');

    // Primeiro, vamos tentar inserir um registro de teste para forçar a criação da tabela
    const testRecord = {
      id: '00000000-0000-0000-0000-000000000000',
      subscription_id: '00000000-0000-0000-0000-000000000000',
      organization_id: '00000000-0000-0000-0000-000000000000', 
      admin_user_id: '00000000-0000-0000-0000-000000000000',
      action_type: 'test',
      reason: 'Teste de criação da tabela',
      notes: 'Registro de teste',
      previous_data: {},
      new_data: {},
      effective_date: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    // Tentar inserir (isso vai falhar, mas pode nos dar mais informações)
    const { data, error } = await supabase
      .from('subscription_audit_log')
      .insert(testRecord);

    if (error) {
      console.log('❌ Erro esperado:', error.message);
      
      if (error.message.includes('schema cache')) {
        console.log('🔍 Tabela não existe no cache do Supabase');
        console.log('📋 Você precisa criar a tabela manualmente no Supabase Dashboard');
        console.log('');
        console.log('SQL para executar no Supabase SQL Editor:');
        console.log('');
        console.log(`
CREATE TABLE subscription_audit_log (
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

-- Índices
CREATE INDEX idx_subscription_audit_log_subscription_id ON subscription_audit_log(subscription_id);
CREATE INDEX idx_subscription_audit_log_organization_id ON subscription_audit_log(organization_id);
CREATE INDEX idx_subscription_audit_log_created_at ON subscription_audit_log(created_at DESC);

-- RLS
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
        
      }
    } else {
      console.log('✅ Tabela existe e registro inserido');
      
      // Remover o registro de teste
      await supabase
        .from('subscription_audit_log')
        .delete()
        .eq('id', testRecord.id);
        
      console.log('🧹 Registro de teste removido');
    }

    // Testar organizações com query mais simples
    console.log('\n🔍 Testando organizações...');
    
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(5);

    if (orgError) {
      console.log('❌ Erro ao buscar organizações:', orgError.message);
    } else {
      console.log(`✅ Encontradas ${orgs?.length || 0} organizações`);
      
      if (orgs && orgs.length > 0) {
        // Para cada organização, buscar assinatura separadamente
        for (const org of orgs.slice(0, 3)) {
          const { data: subs, error: subError } = await supabase
            .from('subscriptions')
            .select(`
              id,
              status,
              billing_cycle,
              subscription_plans (
                name,
                monthly_price
              )
            `)
            .eq('organization_id', org.id)
            .limit(1);

          if (!subError && subs && subs.length > 0) {
            const sub = subs[0];
            console.log(`   - ${org.name}: ${sub.status} (${sub.subscription_plans?.name})`);
          } else {
            console.log(`   - ${org.name}: Sem assinatura`);
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

createAuditTable();