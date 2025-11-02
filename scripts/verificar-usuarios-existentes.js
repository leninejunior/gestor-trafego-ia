#!/usr/bin/env node

/**
 * Script para verificar usuários existentes e criar o Lenine se necessário
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function verificarUsuariosExistentes() {
  console.log('👥 Verificando usuários existentes...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Listar todos os usuários
    console.log('1️⃣ Listando todos os usuários...');
    
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('❌ Erro ao listar usuários:', usersError.message);
      return;
    }

    console.log('📊 Usuários encontrados:', users.users?.length || 0);
    users.users?.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.id})`);
      console.log(`      Criado: ${user.created_at}`);
      console.log(`      Confirmado: ${user.email_confirmed_at ? 'Sim' : 'Não'}`);
      console.log('');
    });

    // 2. Verificar se existe algum usuário com domínio amitie.com.br
    const amitieUsers = users.users?.filter(user => user.email?.includes('amitie.com.br'));
    console.log('📧 Usuários do domínio amitie.com.br:', amitieUsers?.length || 0);
    amitieUsers?.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email}`);
    });

    // 3. Verificar super_admins existentes
    console.log('\n2️⃣ Verificando super_admins...');
    
    const { data: superAdmins, error: superAdminError } = await supabase
      .from('super_admins')
      .select('*');

    if (superAdminError) {
      console.error('❌ Erro ao buscar super_admins:', superAdminError.message);
    } else {
      console.log('📊 Super admins encontrados:', superAdmins?.length || 0);
      superAdmins?.forEach((admin, index) => {
        console.log(`   ${index + 1}. ${admin.user_id} - ${admin.email || 'Email não definido'}`);
      });
    }

    // 4. Criar usuário Lenine se não existir
    const lenineExists = users.users?.find(user => user.email === 'lenine@amitie.com.br');
    
    if (!lenineExists) {
      console.log('\n3️⃣ Criando usuário Lenine...');
      
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: 'lenine@amitie.com.br',
        password: 'Amitie2024!',
        email_confirm: true,
        user_metadata: {
          name: 'Lenine Amitie',
          role: 'super_admin'
        }
      });

      if (createUserError) {
        console.error('❌ Erro ao criar usuário:', createUserError.message);
      } else {
        console.log('✅ Usuário Lenine criado:', newUser.user?.id);
        
        // Adicionar à tabela super_admins
        const { data: newSuperAdmin, error: superAdminCreateError } = await supabase
          .from('super_admins')
          .insert({
            user_id: newUser.user?.id,
            email: 'lenine@amitie.com.br',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select();

        if (superAdminCreateError) {
          console.error('❌ Erro ao criar super admin:', superAdminCreateError.message);
        } else {
          console.log('✅ Super admin criado:', newSuperAdmin[0]);
        }
      }
    } else {
      console.log('\n3️⃣ Usuário Lenine já existe:', lenineExists.id);
      
      // Verificar se é super admin
      const isSuperAdmin = superAdmins?.find(admin => admin.user_id === lenineExists.id);
      if (!isSuperAdmin) {
        console.log('🔄 Adicionando Lenine como super admin...');
        
        const { data: newSuperAdmin, error: superAdminCreateError } = await supabase
          .from('super_admins')
          .insert({
            user_id: lenineExists.id,
            email: lenineExists.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select();

        if (superAdminCreateError) {
          console.error('❌ Erro ao criar super admin:', superAdminCreateError.message);
        } else {
          console.log('✅ Super admin criado:', newSuperAdmin[0]);
        }
      } else {
        console.log('✅ Lenine já é super admin');
      }
    }

    // 5. Verificar organizações
    console.log('\n4️⃣ Verificando organizações...');
    
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

    console.log('\n🎉 Verificação concluída!');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

verificarUsuariosExistentes().catch(console.error);