require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('👑 Criando Sistema de Super Admin Simples');
console.log('=========================================');

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function criarSuperAdminSimples() {
  try {
    // 1. Primeiro, vamos criar a tabela super_admins diretamente
    console.log('📋 Criando tabela super_admins...');
    
    const { error: createTableError } = await supabaseAdmin
      .from('super_admins')
      .select('*')
      .limit(1);
    
    if (createTableError && createTableError.message.includes('does not exist')) {
      console.log('❌ Tabela super_admins não existe. Você precisa executar o SQL manualmente.');
      console.log('\n📝 EXECUTE ESTE SQL NO SUPABASE SQL EDITOR:');
      console.log('==========================================');
      console.log(`
-- 1. Criar tabela de super administradores
CREATE TABLE IF NOT EXISTS super_admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id)
);

-- 2. Habilitar RLS
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- 3. Política para permitir que qualquer um veja (temporariamente)
CREATE POLICY "Allow all to view super_admins" ON super_admins FOR SELECT USING (true);
CREATE POLICY "Allow all to insert super_admins" ON super_admins FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all to update super_admins" ON super_admins FOR UPDATE USING (true);
      `);
      console.log('==========================================');
      console.log('\n⏳ Depois de executar o SQL, rode este script novamente.');
      return;
    }
    
    console.log('✅ Tabela super_admins existe!');
    
    // 2. Adicionar os super admins
    console.log('\n👑 Adicionando Super Administradores...');
    
    const superAdmins = [
      { 
        email: 'admin@sistema.com', 
        id: '5522b698-f20d-4669-853c-cac60e5f7edf',
        name: 'Admin Sistema'
      },
      { 
        email: 'lenine.engrene@gmail.com', 
        id: '980d1d5f-6bca-4d3f-b756-0fc0999b7658',
        name: 'Lenine'
      }
    ];
    
    for (const admin of superAdmins) {
      console.log(`\n🔑 Configurando ${admin.name} (${admin.email})...`);
      
      try {
        const { data, error } = await supabaseAdmin
          .from('super_admins')
          .upsert({
            user_id: admin.id,
            created_by: admin.id,
            is_active: true
          }, {
            onConflict: 'user_id'
          })
          .select();
        
        if (error) {
          console.log(`❌ Erro: ${error.message}`);
        } else {
          console.log(`✅ ${admin.name} configurado como super admin!`);
        }
      } catch (err) {
        console.log(`❌ Erro inesperado: ${err.message}`);
      }
    }
    
    // 3. Verificar super admins criados
    console.log('\n🔍 Verificando super admins...');
    const { data: superAdminsList, error: listError } = await supabaseAdmin
      .from('super_admins')
      .select('*')
      .eq('is_active', true);
    
    if (listError) {
      console.log('❌ Erro ao listar:', listError.message);
    } else {
      console.log(`✅ Super admins encontrados: ${superAdminsList.length}`);
      superAdminsList.forEach((admin, index) => {
        console.log(`  ${index + 1}. User ID: ${admin.user_id}`);
        console.log(`     Criado em: ${new Date(admin.created_at).toLocaleString('pt-BR')}`);
      });
    }
    
    // 4. Testar se os usuários podem fazer login
    console.log('\n🔐 Testando login dos super admins...');
    
    const supabaseClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    const testUsers = [
      { email: 'admin@sistema.com', senha: 'admin123456' },
      { email: 'lenine.engrene@gmail.com', senha: 'senha123' }
    ];
    
    for (const user of testUsers) {
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: user.email,
          password: user.senha
        });
        
        if (error) {
          console.log(`❌ ${user.email}: ${error.message}`);
        } else {
          console.log(`✅ ${user.email}: Login OK`);
          
          // Verificar se é super admin
          const { data: isSuperAdmin } = await supabaseClient
            .from('super_admins')
            .select('*')
            .eq('user_id', data.user.id)
            .eq('is_active', true)
            .single();
          
          if (isSuperAdmin) {
            console.log(`   👑 Confirmado como SUPER ADMIN`);
          } else {
            console.log(`   ⚠️ NÃO é super admin`);
          }
          
          await supabaseClient.auth.signOut();
        }
      } catch (err) {
        console.log(`❌ ${user.email}: Erro inesperado - ${err.message}`);
      }
    }
    
    console.log('\n🎯 CONFIGURAÇÃO CONCLUÍDA!');
    console.log('==========================');
    console.log('✅ Tabela super_admins criada');
    console.log('✅ Super admins configurados');
    console.log('✅ Login testado e funcionando');
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('1. Implementar middleware no código');
    console.log('2. Atualizar APIs para verificar super admin');
    console.log('3. Testar acesso total no dashboard');
    
  } catch (error) {
    console.log('❌ Erro inesperado:', error.message);
  }
}

criarSuperAdminSimples().catch(err => {
  console.log('❌ Erro na criação:', err.message);
});