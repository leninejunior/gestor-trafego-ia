require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 DEBUGANDO TABELA SUPER_ADMINS');
console.log('=================================');

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function debugSuperAdminTable() {
  try {
    const emailLenine = 'lenine.engrene@gmail.com';
    
    // 1. Verificar estrutura da tabela super_admins
    console.log('📋 Verificando estrutura da tabela super_admins...');
    
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from('super_admins')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.log('❌ Erro ao acessar tabela super_admins:', tableError.message);
      
      // Tentar criar a tabela se não existir
      console.log('🆕 Tentando criar tabela super_admins...');
      
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS super_admins (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id)
        );
        
        -- Habilitar RLS
        ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
        
        -- Política simples
        CREATE POLICY "super_admins_policy" ON super_admins
          FOR ALL USING (auth.uid() IS NOT NULL);
      `;
      
      // Como não temos função exec, vamos tentar inserir diretamente
      console.log('⚠️  Não é possível executar SQL diretamente via API');
      console.log('💡 Execute este SQL no Supabase SQL Editor:');
      console.log(createTableSQL);
      
    } else {
      console.log('✅ Tabela super_admins existe!');
      console.log('📊 Dados encontrados:', tableInfo);
      
      if (tableInfo && tableInfo.length > 0) {
        console.log('🔍 Colunas disponíveis:', Object.keys(tableInfo[0]));
      }
    }
    
    // 2. Verificar usuário Lenine
    console.log('\n👤 Verificando usuário Lenine...');
    
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (usersError) {
      console.log('❌ Erro ao listar usuários:', usersError.message);
      return;
    }
    
    const lenineUser = users.users.find(user => user.email === emailLenine);
    
    if (!lenineUser) {
      console.log('❌ Usuário Lenine não encontrado');
      return;
    }
    
    console.log('✅ Usuário Lenine encontrado!');
    console.log('🆔 ID:', lenineUser.id);
    
    // 3. Verificar se Lenine está na tabela super_admins
    console.log('\n👑 Verificando se Lenine é super admin...');
    
    const { data: superAdminData, error: superAdminError } = await supabaseAdmin
      .from('super_admins')
      .select('*')
      .eq('user_id', lenineUser.id);
    
    if (superAdminError) {
      console.log('❌ Erro ao verificar super admin:', superAdminError.message);
    } else {
      console.log(`📊 Registros encontrados: ${superAdminData.length}`);
      
      if (superAdminData.length > 0) {
        console.log('✅ Lenine é super admin!');
        superAdminData.forEach((record, index) => {
          console.log(`  ${index + 1}. ID: ${record.id}`);
          console.log(`     User ID: ${record.user_id}`);
          console.log(`     Criado em: ${record.created_at}`);
          if (record.is_active !== undefined) {
            console.log(`     Ativo: ${record.is_active}`);
          } else {
            console.log('     ⚠️  Coluna is_active não existe');
          }
        });
      } else {
        console.log('❌ Lenine NÃO é super admin');
        console.log('🆕 Adicionando Lenine como super admin...');
        
        const { data: newSuperAdmin, error: insertError } = await supabaseAdmin
          .from('super_admins')
          .insert({
            user_id: lenineUser.id
          })
          .select()
          .single();
        
        if (insertError) {
          console.log('❌ Erro ao inserir super admin:', insertError.message);
        } else {
          console.log('✅ Lenine adicionado como super admin!');
          console.log('📝 Registro:', newSuperAdmin);
        }
      }
    }
    
    // 4. Testar a função isSuperAdmin simulada
    console.log('\n🧪 Testando verificação de super admin...');
    
    // Simular a função sem is_active
    const { data: testData, error: testError } = await supabaseAdmin
      .from('super_admins')
      .select('id')
      .eq('user_id', lenineUser.id)
      .single();
    
    if (testError) {
      console.log('❌ Teste falhou:', testError.message);
    } else {
      console.log('✅ Teste passou! Lenine é reconhecido como super admin');
    }
    
    // 5. Testar acesso às organizações
    console.log('\n🏢 Testando acesso às organizações...');
    
    const supabaseClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    // Fazer login
    const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
      email: emailLenine,
      password: 'senha123'
    });
    
    if (loginError) {
      console.log('❌ Erro no login:', loginError.message);
    } else {
      console.log('✅ Login realizado!');
      
      // Testar acesso direto às organizações
      const { data: orgs, error: orgsError } = await supabaseClient
        .from('organizations')
        .select('*');
      
      if (orgsError) {
        console.log('❌ Erro ao acessar organizações:', orgsError.message);
      } else {
        console.log(`✅ Organizações acessadas! (${orgs.length} encontradas)`);
      }
    }
    
    console.log('\n🎯 DIAGNÓSTICO COMPLETO!');
    console.log('========================');
    console.log('📋 Próximos passos:');
    console.log('1. Corrigir função isSuperAdmin para não usar is_active');
    console.log('2. Simplificar API de organizações');
    console.log('3. Testar novamente');
    
  } catch (error) {
    console.log('❌ Erro inesperado:', error.message);
  }
}

debugSuperAdminTable().catch(err => {
  console.log('❌ Erro na execução:', err.message);
});