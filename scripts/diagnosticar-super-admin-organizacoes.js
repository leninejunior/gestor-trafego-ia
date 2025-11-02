#!/usr/bin/env node

/**
 * Script para diagnosticar problema do super admin não ver organizações
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function diagnosticarSuperAdminOrganizacoes() {
  console.log('🔍 Diagnosticando problema do super admin com organizações...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Verificar se o usuário existe e é super admin
    console.log('1️⃣ Verificando usuário super admin...');
    
    // Buscar na tabela super_admins diretamente
    const { data: superAdmins, error: superAdminError } = await supabase
      .from('super_admins')
      .select('*');

    if (superAdminError) {
      console.error('❌ Erro ao buscar super admins:', superAdminError.message);
      return;
    }

    console.log('📊 Super admins encontrados:', superAdmins?.length || 0);
    superAdmins?.forEach((admin, index) => {
      console.log(`   ${index + 1}. ${admin.user_id} - ${admin.email}`);
    });

    const lenineAdmin = superAdmins?.find(admin => admin.email === 'lenine@amitie.com.br');
    if (!lenineAdmin) {
      console.log('❌ Lenine não encontrado como super admin');
      return;
    }

    console.log('✅ Lenine é super admin:', lenineAdmin.user_id);

    // 2. Verificar organizações existentes
    console.log('\n2️⃣ Verificando organizações existentes...');

    // 3. Verificar RLS policies para organizations
    console.log('\n3️⃣ Verificando RLS policies para organizations...');
    
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

    // 4. Testar acesso direto às organizações como super admin
    console.log('\n4️⃣ Testando acesso direto às organizações...');
    
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_table_policies', { table_name: 'organizations' });

    if (policiesError) {
      console.error('❌ Erro ao verificar policies:', policiesError.message);
    } else {
      console.log('📊 Policies encontradas:', policies?.length || 0);
      policies?.forEach((policy, index) => {
        console.log(`   ${index + 1}. ${policy.policyname} - ${policy.cmd} - ${policy.qual}`);
      });
    }

    // 5. Verificar se existe função para super admin
    console.log('\n5️⃣ Verificando função is_super_admin...');
    
    // Criar cliente com o usuário específico
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Simular login do usuário
    const { data: authData, error: authError } = await userSupabase.auth.signInWithPassword({
      email: 'lenine@amitie.com.br',
      password: 'Amitie2024!'
    });

    if (authError) {
      console.error('❌ Erro ao fazer login:', authError.message);
    } else {
      console.log('✅ Login realizado com sucesso');
      
      // Tentar buscar organizações com o usuário logado
      const { data: userOrgs, error: userOrgsError } = await userSupabase
        .from('organizations')
        .select('*');

      if (userOrgsError) {
        console.error('❌ Erro ao buscar organizações como usuário:', userOrgsError.message);
      } else {
        console.log('📊 Organizações acessíveis pelo usuário:', userOrgs?.length || 0);
      }
    }

    // 6. Verificar API /api/organizations diretamente
    console.log('\n6️⃣ Testando API /api/organizations...');

    // 7. Verificar middleware de autenticação
    console.log('\n7️⃣ Verificando middleware...');
    
    try {
      const response = await fetch('http://localhost:3000/api/organizations', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      console.log('📡 Status da API:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Erro da API:', errorText);
      } else {
        const data = await response.json();
        console.log('✅ API funcionando, dados:', data);
      }
    } catch (apiError) {
      console.error('❌ Erro ao testar API:', apiError.message);
    }

    // 8. Resumo
    console.log('\n8️⃣ Resumo...');
    
    // Verificar se o middleware está funcionando
    const { data: middlewareTest, error: middlewareError } = await supabase
      .from('organizations')
      .select('*')
      .limit(1);

    if (middlewareError) {
      console.error('❌ Erro no middleware:', middlewareError.message);
    } else {
      console.log('✅ Middleware funcionando');
    }

    console.log('\n🎯 RESUMO DO DIAGNÓSTICO:');
    console.log('- Lenine é super admin:', lenineAdmin ? '✅' : '❌');
    console.log('- Organizações existem:', organizations?.length > 0 ? '✅' : '❌');

  } catch (error) {
    console.error('❌ Erro geral no diagnóstico:', error);
  }
}

diagnosticarSuperAdminOrganizacoes().catch(console.error);