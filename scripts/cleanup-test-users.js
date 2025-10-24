#!/usr/bin/env node

/**
 * Script para limpar usuários de teste do Supabase
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupTestUsers() {
  console.log('🧹 Limpando usuários de teste...\n');

  try {
    // Listar todos os usuários
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Erro ao listar usuários:', listError.message);
      return;
    }

    console.log(`📊 Total de usuários: ${users.length}\n`);

    // Filtrar usuários de teste
    const testUsers = users.filter(user => 
      user.email?.includes('teste') || 
      user.email?.includes('test') ||
      user.email?.includes('exemplo')
    );

    if (testUsers.length === 0) {
      console.log('✅ Nenhum usuário de teste encontrado!\n');
      return;
    }

    console.log(`🎯 Encontrados ${testUsers.length} usuários de teste:\n`);
    
    testUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.id})`);
    });

    console.log('\n⚠️  ATENÇÃO: Estes usuários serão deletados!\n');
    console.log('Para confirmar, execute:');
    console.log('node scripts/cleanup-test-users.js --confirm\n');

    // Verificar se tem flag de confirmação
    if (process.argv.includes('--confirm')) {
      console.log('🗑️  Deletando usuários de teste...\n');

      for (const user of testUsers) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        
        if (deleteError) {
          console.log(`❌ Erro ao deletar ${user.email}:`, deleteError.message);
        } else {
          console.log(`✅ Deletado: ${user.email}`);
        }
      }

      console.log('\n✅ Limpeza concluída!\n');
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

cleanupTestUsers();
