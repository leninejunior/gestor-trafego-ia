#!/usr/bin/env node

/**
 * Script para verificar se as tabelas necessárias para signup existem
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTables() {
  console.log('🔍 Verificando tabelas necessárias para signup...\n');

  const tables = [
    { name: 'profiles', description: 'Perfis de usuários' },
    { name: 'organizations', description: 'Organizações' },
    { name: 'memberships', description: 'Membros das organizações' }
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table.name)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ ${table.name}: ${error.message}`);
      } else {
        console.log(`✅ ${table.name}: OK (${table.description})`);
      }
    } catch (err) {
      console.log(`❌ ${table.name}: ${err.message}`);
    }
  }

  console.log('\n🔍 Verificando estrutura da tabela organizations...\n');

  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .limit(0);

    if (error) {
      console.log('❌ Erro ao verificar estrutura:', error.message);
    } else {
      console.log('✅ Tabela organizations existe e está acessível');
    }
  } catch (err) {
    console.log('❌ Erro:', err.message);
  }

  console.log('\n🔍 Testando inserção na tabela organizations...\n');

  try {
    const testSlug = 'test-org-' + Date.now();
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: 'Test Organization',
        slug: testSlug
      })
      .select()
      .single();

    if (error) {
      console.log('❌ Erro ao inserir:', error.message);
      console.log('Detalhes:', error);
    } else {
      console.log('✅ Inserção bem-sucedida!');
      console.log('Organização criada:', data);

      // Limpar teste
      await supabase
        .from('organizations')
        .delete()
        .eq('id', data.id);
      console.log('✅ Organização de teste removida');
    }
  } catch (err) {
    console.log('❌ Erro:', err.message);
  }
}

checkTables();
