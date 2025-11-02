#!/usr/bin/env node

/**
 * Script para corrigir a tabela super_admins e configurar o Lenine
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function corrigirSuperAdminTable() {
  console.log('🔧 Corrigindo tabela super_admins e configurando Lenine...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Adicionar coluna email à tabela super_admins se não existir
    console.log('1️⃣ Adicionando coluna email à tabela super_admins...');
    
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'super_admins' 
            AND column_name = 'email'
          ) THEN
            ALTER TABLE super_admins ADD COLUMN email TEXT;
            ALTER TABLE super_admins ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
          END IF;
        END $$;
      `
    });

    if (alterError) {
      console.log('⚠️ Não foi possível usar rpc, tentando SQL direto...');
      
      // Tentar executar SQL diretamente
      try {
        await supabase.from('super_admins').select('email').limit(1);
        console.log('✅ Coluna email já existe');
      } catch (columnError) {
        console.log('❌ Coluna email não existe, mas não conseguimos adicionar via script');
        console.log('💡 Execute manualmente no Supabase SQL Editor:');
        console.log('   ALTER TABLE super_admins ADD COLUMN email TEXT;');
        console.log('   ALTER TABLE super_admins ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();');
      }
    } else {
      console.log('✅ Coluna email adicionada com sucesso');
    }

    // 2. Buscar usuário Lenine
    console.log('\n2️⃣ Buscando usuário Lenine...');
    
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('❌ Erro ao listar usuários:', usersError.message);
      return;
    }

    const lenineUser = users.users?.find(user => user.email === 'lenine@amitie.com.br');
    if (!lenineUser) {
      console.log('❌ Usuário lenine@amitie.com.br não encontrado');
      return;
    }

    console.log('✅ Usuário Lenine encontrado:', lenineUser.id);

    // 3. Verificar se já é super admin
    console.log('\n3️⃣ Verificando se Lenine já é super admin...');
    
    const { data: existingSuperAdmin, error: checkError } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', lenineUser.id);

    if (checkError) {
      console.error('❌ Erro ao verificar super admin:', checkError.message);
      return;
    }

    if (existingSuperAdmin && existingSuperAdmin.length > 0) {
      console.log('✅ Lenine já é super admin');
      
      // Atualizar com email se não tiver
      const { error: updateError } = await supabase
        .from('super_admins')
        .update({ 
          email: lenineUser.email,
          updated_at: new Date().toISOString(),
          is_active: true
        })
        .eq('user_id', lenineUser.id);

      if (updateError) {
        console.log('⚠️ Não foi possível atualizar email (coluna pode não existir)');
      } else {
        console.log('✅ Email atualizado');
      }
    } else {
      console.log('❌ Lenine não é super admin, adicionando...');
      
      // Adicionar como super admin
      const insertData = {
        user_id: lenineUser.id,
        created_at: new Date().toISOString(),
        is_active: true
      };

      // Tentar adicionar email se a coluna existir
      try {
        insertData.email = lenineUser.email;
        insertData.updated_at = new Date().toISOString();
      } catch (e) {
        console.log('⚠️ Coluna email não existe, inserindo sem email');
      }

      const { data: newSuperAdmin, error: createError } = await supabase
        .from('super_admins')
        .insert(insertData)
        .select();

      if (createError) {
        console.error('❌ Erro ao criar super admin:', createError.message);
      } else {
        console.log('✅ Super admin criado:', newSuperAdmin[0]);
      }
    }

    // 4. Testar função is_super_admin
    console.log('\n4️⃣ Testando função is_super_admin...');
    
    const { data: isSuperAdmin, error: functionError } = await supabase
      .rpc('is_super_admin', { user_uuid: lenineUser.id });

    if (functionError) {
      console.error('❌ Erro na função is_super_admin:', functionError.message);
    } else {
      console.log('📊 is_super_admin resultado:', isSuperAdmin);
    }

    // 5. Verificar organizações
    console.log('\n5️⃣ Verificando organizações...');
    
    const { data: organizations, error: orgsError } = await supabase
      .from('organizations')
      .select('*');

    if (orgsError) {
      console.error('❌ Erro ao buscar organizações:', orgsError.message);
    } else {
      console.log('📊 Organizações encontradas:', organizations?.length || 0);
      organizations?.forEach((org, index) => {
        console.log(`   ${index + 1}. ${org.name} (${org.id})`);
      });
    }

    // 6. Criar membership para Lenine na organização existente se não tiver
    if (organizations && organizations.length > 0) {
      console.log('\n6️⃣ Verificando membership do Lenine...');
      
      const org = organizations[0];
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('*')
        .eq('user_id', lenineUser.id)
        .eq('org_id', org.id);

      if (membershipError) {
        console.error('❌ Erro ao verificar membership:', membershipError.message);
      } else if (!membership || membership.length === 0) {
        console.log('🔄 Criando membership para Lenine...');
        
        const { data: newMembership, error: createMembershipError } = await supabase
          .from('memberships')
          .insert({
            user_id: lenineUser.id,
            org_id: org.id,
            role: 'admin',
            created_at: new Date().toISOString()
          })
          .select();

        if (createMembershipError) {
          console.error('❌ Erro ao criar membership:', createMembershipError.message);
        } else {
          console.log('✅ Membership criado:', newMembership[0]);
        }
      } else {
        console.log('✅ Lenine já tem membership na organização');
      }
    }

    console.log('\n🎉 Correção concluída!');
    console.log('\n💡 Agora teste acessar /admin/organizations no navegador');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

corrigirSuperAdminTable().catch(console.error);