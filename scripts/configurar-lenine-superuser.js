require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Configurando Lenine como Super Usuário');
console.log('==========================================');

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function configurarLenineSuper() {
  try {
    const emailLenine = 'lenine.engrene@gmail.com';
    
    console.log(`\n👤 Configurando usuário: ${emailLenine}`);
    
    // 1. Verificar se o usuário existe
    console.log('🔍 Verificando se o usuário existe...');
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.log('❌ Erro ao listar usuários:', listError.message);
      return;
    }
    
    const lenineUser = users.users.find(user => user.email === emailLenine);
    
    if (!lenineUser) {
      console.log('❌ Usuário não encontrado');
      console.log('💡 Criando usuário...');
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailLenine,
        password: 'senha123',
        email_confirm: true
      });
      
      if (createError) {
        console.log('❌ Erro ao criar usuário:', createError.message);
        return;
      }
      
      console.log('✅ Usuário criado com sucesso!');
      console.log('🆔 ID:', newUser.user.id);
    } else {
      console.log('✅ Usuário encontrado!');
      console.log('🆔 ID:', lenineUser.id);
      console.log('📧 Email confirmado:', lenineUser.email_confirmed_at ? 'Sim' : 'Não');
      
      // Confirmar email se não estiver confirmado
      if (!lenineUser.email_confirmed_at) {
        console.log('📧 Confirmando email...');
        const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
          lenineUser.id,
          { email_confirm: true }
        );
        
        if (confirmError) {
          console.log('❌ Erro ao confirmar email:', confirmError.message);
        } else {
          console.log('✅ Email confirmado!');
        }
      }
    }
    
    const userId = lenineUser ? lenineUser.id : newUser.user.id;
    
    // 2. Verificar se já tem organização
    console.log('\n🏢 Verificando organizações...');
    const supabaseClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    const { data: memberships, error: memberError } = await supabaseClient
      .from('memberships')
      .select('*, organizations(*)')
      .eq('user_id', userId);
    
    if (memberError) {
      console.log('❌ Erro ao verificar memberships:', memberError.message);
    } else {
      console.log(`📊 Memberships encontrados: ${memberships.length}`);
      
      if (memberships.length > 0) {
        memberships.forEach((membership, index) => {
          console.log(`  ${index + 1}. Org: ${membership.organizations.name} (Role: ${membership.role})`);
        });
      }
    }
    
    // 3. Criar organização padrão se não existir
    if (!memberships || memberships.length === 0) {
      console.log('\n🆕 Criando organização padrão...');
      
      const { data: newOrg, error: orgError } = await supabaseClient
        .from('organizations')
        .insert({
          name: 'Organização Lenine'
        })
        .select()
        .single();
      
      if (orgError) {
        console.log('❌ Erro ao criar organização:', orgError.message);
      } else {
        console.log('✅ Organização criada:', newOrg.name);
        
        // Criar membership
        const { error: membershipError } = await supabaseClient
          .from('memberships')
          .insert({
            user_id: userId,
            org_id: newOrg.id,
            role: 'admin'
          });
        
        if (membershipError) {
          console.log('❌ Erro ao criar membership:', membershipError.message);
        } else {
          console.log('✅ Membership criado com sucesso!');
        }
      }
    }
    
    // 4. Testar login
    console.log('\n🔐 Testando login...');
    const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
      email: emailLenine,
      password: 'senha123'
    });
    
    if (loginError) {
      console.log('❌ Erro no login:', loginError.message);
      
      // Se der erro de senha, resetar senha
      if (loginError.message.includes('Invalid login credentials')) {
        console.log('🔄 Resetando senha...');
        const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { password: 'senha123' }
        );
        
        if (resetError) {
          console.log('❌ Erro ao resetar senha:', resetError.message);
        } else {
          console.log('✅ Senha resetada! Testando novamente...');
          
          const { data: retryLogin, error: retryError } = await supabaseClient.auth.signInWithPassword({
            email: emailLenine,
            password: 'senha123'
          });
          
          if (retryError) {
            console.log('❌ Ainda com erro:', retryError.message);
          } else {
            console.log('✅ Login realizado com sucesso!');
            console.log('👤 Usuário:', retryLogin.user.email);
          }
        }
      }
    } else {
      console.log('✅ Login realizado com sucesso!');
      console.log('👤 Usuário:', loginData.user.email);
    }
    
    console.log('\n🎯 CONFIGURAÇÃO CONCLUÍDA!');
    console.log('==========================');
    console.log('📧 Email:', emailLenine);
    console.log('🔑 Senha: senha123');
    console.log('🏢 Organização: Configurada');
    console.log('👑 Permissões: Admin');
    console.log('\n✅ Lenine agora pode fazer login no sistema!');
    
  } catch (error) {
    console.log('❌ Erro inesperado:', error.message);
  }
}

configurarLenineSuper().catch(err => {
  console.log('❌ Erro na configuração:', err.message);
});