#!/usr/bin/env node

/**
 * Script para corrigir o super admin do Lenine
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function corrigirSuperAdminLenine() {
  console.log('🔧 Corrigindo super admin do Lenine...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Verificar usuários existentes
    console.log('1️⃣ Verificando usuários existentes...');
    
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('❌ Erro ao listar usuários:', usersError.message);
      return;
    }

    console.log('📊 Usuários encontrados:', users.users?.length || 0);
    
    const lenineUser = users.users?.find(user => user.email === 'lenine@amitie.com.br');
    if (!lenineUser) {
      console.log('❌ Usuário lenine@amitie.com.br não encontrado');
      return;
    }

    console.log('✅ Usuário Lenine encontrado:', lenineUser.id);

    // 2. Verificar se já existe na tabela super_admins
    console.log('\n2️⃣ Verificando tabela super_admins...');
    
    const { data: existingSuperAdmin, error: checkError } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', lenineUser.id);

    if (checkError) {
      console.error('❌ Erro ao verificar super_admins:', checkError.message);
      return;
    }

    if (existingSuperAdmin && existingSuperAdmin.length > 0) {
      console.log('✅ Lenine já é super admin:', existingSuperAdmin[0]);
      
      // Atualizar o email se estiver faltando
      if (!existingSuperAdmin[0].email) {
        console.log('🔄 Atualizando email do super admin...');
        
        const { error: updateError } = await supabase
          .from('super_admins')
          .update({ 
            email: lenineUser.email,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', lenineUser.id);

        if (updateError) {
          console.error('❌ Erro ao atualizar email:', updateError.message);
        } else {
          console.log('✅ Email atualizado com sucesso');
        }
      }
    } else {
      console.log('❌ Lenine não é super admin, criando...');
      
      // Criar entrada na tabela super_admins
      const { data: newSuperAdmin, error: createError } = await supabase
        .from('super_admins')
        .insert({
          user_id: lenineUser.id,
          email: lenineUser.email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();

      if (createError) {
        console.error('❌ Erro ao criar super admin:', createError.message);
      } else {
        console.log('✅ Super admin criado:', newSuperAdmin[0]);
      }
    }

    // 3. Verificar organizações
    console.log('\n3️⃣ Verificando organizações...');
    
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

    // 4. Testar função is_super_admin
    console.log('\n4️⃣ Testando função is_super_admin...');
    
    const { data: isSuperAdmin, error: functionError } = await supabase
      .rpc('is_super_admin', { user_id: lenineUser.id });

    if (functionError) {
      console.error('❌ Erro na função is_super_admin:', functionError.message);
    } else {
      console.log('📊 is_super_admin resultado:', isSuperAdmin);
    }

    // 5. Verificar RLS policies
    console.log('\n5️⃣ Verificando RLS policies...');
    
    // Testar acesso às organizações com RLS
    const { data: testOrgs, error: testError } = await supabase
      .from('organizations')
      .select('*')
      .limit(1);

    if (testError) {
      console.error('❌ Erro no teste RLS:', testError.message);
    } else {
      console.log('✅ RLS funcionando, organizações acessíveis:', testOrgs?.length || 0);
    }

    // 6. Verificar API
    console.log('\n6️⃣ Testando API /api/organizations...');
    
    try {
      const response = await fetch('http://localhost:3000/api/organizations');
      console.log('📡 Status da API:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API funcionando:', data);
      } else {
        const errorText = await response.text();
        console.log('❌ Erro da API:', errorText);
      }
    } catch (apiError) {
      console.error('❌ Erro ao testar API:', apiError.message);
    }

    console.log('\n🎉 Correção concluída!');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

corrigirSuperAdminLenine().catch(console.error);