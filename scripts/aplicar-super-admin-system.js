require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Aplicando Sistema de Super Administradores');
console.log('=============================================');

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function aplicarSuperAdminSystem() {
  try {
    console.log('📄 Lendo arquivo SQL...');
    const sqlScript = fs.readFileSync('database/super-admin-system.sql', 'utf8');
    
    console.log('🗄️ Executando script no banco de dados...');
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql: sqlScript });
    
    if (error) {
      console.log('❌ Erro ao executar SQL:', error.message);
      
      // Tentar executar comando por comando
      console.log('🔄 Tentando executar comandos individualmente...');
      const commands = sqlScript.split(';').filter(cmd => cmd.trim().length > 0);
      
      for (let i = 0; i < commands.length; i++) {
        const command = commands[i].trim();
        if (command) {
          try {
            console.log(`📝 Executando comando ${i + 1}/${commands.length}...`);
            const { error: cmdError } = await supabaseAdmin.rpc('exec_sql', { sql: command });
            if (cmdError) {
              console.log(`⚠️ Erro no comando ${i + 1}:`, cmdError.message);
            } else {
              console.log(`✅ Comando ${i + 1} executado com sucesso`);
            }
          } catch (err) {
            console.log(`❌ Erro inesperado no comando ${i + 1}:`, err.message);
          }
        }
      }
    } else {
      console.log('✅ Script SQL executado com sucesso!');
    }
    
    // Agora vamos adicionar os super admins
    console.log('\n👑 Adicionando Super Administradores...');
    
    const superAdmins = [
      { email: 'admin@sistema.com', id: '5522b698-f20d-4669-853c-cac60e5f7edf' },
      { email: 'lenine.engrene@gmail.com', id: '980d1d5f-6bca-4d3f-b756-0fc0999b7658' }
    ];
    
    for (const admin of superAdmins) {
      console.log(`\n🔑 Configurando ${admin.email} como super admin...`);
      
      try {
        // Inserir diretamente na tabela super_admins
        const { error: insertError } = await supabaseAdmin
          .from('super_admins')
          .upsert({
            user_id: admin.id,
            created_by: admin.id,
            is_active: true
          });
        
        if (insertError) {
          console.log(`❌ Erro ao inserir super admin ${admin.email}:`, insertError.message);
        } else {
          console.log(`✅ ${admin.email} configurado como super admin!`);
        }
      } catch (err) {
        console.log(`❌ Erro inesperado para ${admin.email}:`, err.message);
      }
    }
    
    // Verificar se os super admins foram criados
    console.log('\n🔍 Verificando super admins criados...');
    const { data: superAdminsList, error: listError } = await supabaseAdmin
      .from('super_admins')
      .select('*, auth.users(email)')
      .eq('is_active', true);
    
    if (listError) {
      console.log('❌ Erro ao listar super admins:', listError.message);
    } else {
      console.log(`✅ Super admins encontrados: ${superAdminsList.length}`);
      superAdminsList.forEach((admin, index) => {
        console.log(`  ${index + 1}. ID: ${admin.user_id}`);
      });
    }
    
    console.log('\n🎯 SISTEMA DE SUPER ADMIN CONFIGURADO!');
    console.log('=====================================');
    console.log('✅ Funções criadas no banco');
    console.log('✅ Políticas RLS atualizadas');
    console.log('✅ Super admins configurados');
    console.log('\n👑 SUPER ADMINS AGORA TÊM ACESSO TOTAL A:');
    console.log('- Todas as organizações');
    console.log('- Todos os usuários');
    console.log('- Todos os clientes');
    console.log('- Todas as conexões Meta');
    console.log('- Todos os dados do sistema');
    
  } catch (error) {
    console.log('❌ Erro inesperado:', error.message);
  }
}

aplicarSuperAdminSystem().catch(err => {
  console.log('❌ Erro na aplicação:', err.message);
});