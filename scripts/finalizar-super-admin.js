const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function finalizarSuperAdmin() {
  console.log('🔧 Finalizando configuração do Super Admin...\n');

  try {
    // 1. Verificar se o usuário existe
    const { data: user, error: userError } = await supabase.auth.admin.getUserById('f7313dc4-e5e1-400b-ba3e-1fee686df937');
    
    if (userError) {
      console.log('❌ Erro ao buscar usuário:', userError.message);
      return;
    }

    console.log('✅ Usuário encontrado:', user.user.email);

    // 2. Verificar se já é super admin
    const { data: existingSuperAdmin } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', user.user.id)
      .single();

    if (!existingSuperAdmin) {
      // 3. Inserir como super admin
      const { error: insertError } = await supabase
        .from('super_admins')
        .insert({
          user_id: user.user.id,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.log('❌ Erro ao inserir super admin:', insertError.message);
      } else {
        console.log('✅ Super admin inserido com sucesso');
      }
    } else {
      console.log('✅ Usuário já é super admin');
    }

    // 4. Testar acesso às organizações
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('*');

    if (orgsError) {
      console.log('❌ Erro ao acessar organizações:', orgsError.message);
    } else {
      console.log(`✅ Organizações acessíveis: ${orgs.length}`);
    }

    // 5. Testar API
    const response = await fetch('http://localhost:3000/api/organizations', {
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    console.log(`📡 Status da API /api/organizations: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ API funcionando, organizações: ${data.length || 0}`);
    } else {
      const error = await response.text();
      console.log('❌ Erro na API:', error);
    }

    console.log('\n🎉 Configuração finalizada!');
    console.log('👑 Super admin configurado e testado');

  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

finalizarSuperAdmin();