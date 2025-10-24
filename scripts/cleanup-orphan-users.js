#!/usr/bin/env node

/**
 * Script para limpar usuários órfãos (sem membership) do Supabase
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupOrphanUsers() {
  console.log('🧹 Procurando usuários órfãos (sem membership)...\n');

  try {
    // Listar todos os usuários
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Erro ao listar usuários:', listError.message);
      return;
    }

    console.log(`📊 Total de usuários: ${users.length}\n`);

    // Verificar quais usuários não têm membership
    const orphanUsers = [];

    for (const user of users) {
      const { data: memberships, error: membershipError } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', user.id);

      if (membershipError) {
        console.log(`⚠️  Erro ao verificar ${user.email}:`, membershipError.message);
        continue;
      }

      if (!memberships || memberships.length === 0) {
        orphanUsers.push(user);
      }
    }

    if (orphanUsers.length === 0) {
      console.log('✅ Nenhum usuário órfão encontrado!\n');
      return;
    }

    console.log(`🎯 Encontrados ${orphanUsers.length} usuários órfãos:\n`);
    
    orphanUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.id})`);
    });

    console.log('\n⚠️  ATENÇÃO: Estes usuários serão deletados!\n');
    console.log('Para confirmar, execute:');
    console.log('node scripts/cleanup-orphan-users.js --confirm\n');

    // Verificar se tem flag de confirmação
    if (process.argv.includes('--confirm')) {
      console.log('🗑️  Deletando usuários órfãos...\n');

      for (const user of orphanUsers) {
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

cleanupOrphanUsers();
