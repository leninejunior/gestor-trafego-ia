#!/usr/bin/env node

/**
 * Script para verificar a estrutura da tabela memberships
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMembershipsSchema() {
  console.log('🔍 Verificando estrutura da tabela memberships...\n');

  try {
    // Tentar inserir com org_id
    console.log('Teste 1: Inserindo com org_id...');
    const testOrgId = '00000000-0000-0000-0000-000000000001';
    const testUserId = '00000000-0000-0000-0000-000000000002';
    
    const { data: test1, error: error1 } = await supabase
      .from('memberships')
      .insert({
        user_id: testUserId,
        org_id: testOrgId,
        role: 'owner'
      })
      .select();

    if (error1) {
      console.log('❌ Erro com org_id:', error1.message);
    } else {
      console.log('✅ Sucesso com org_id!');
      // Limpar
      if (test1 && test1[0]) {
        await supabase.from('memberships').delete().eq('id', test1[0].id);
      }
    }

    // Tentar inserir com organization_id
    console.log('\nTeste 2: Inserindo com organization_id...');
    const { data: test2, error: error2 } = await supabase
      .from('memberships')
      .insert({
        user_id: testUserId,
        organization_id: testOrgId,
        role: 'owner'
      })
      .select();

    if (error2) {
      console.log('❌ Erro com organization_id:', error2.message);
    } else {
      console.log('✅ Sucesso com organization_id!');
      // Limpar
      if (test2 && test2[0]) {
        await supabase.from('memberships').delete().eq('id', test2[0].id);
      }
    }

    // Verificar colunas existentes
    console.log('\nTeste 3: Verificando colunas existentes...');
    const { data: sample, error: sampleError } = await supabase
      .from('memberships')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.log('❌ Erro ao buscar amostra:', sampleError.message);
    } else if (sample && sample.length > 0) {
      console.log('✅ Colunas encontradas:', Object.keys(sample[0]));
    } else {
      console.log('⚠️  Tabela vazia, não foi possível verificar colunas');
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

checkMembershipsSchema();
