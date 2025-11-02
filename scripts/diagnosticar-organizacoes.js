const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔍 DIAGNOSTICANDO PROBLEMA DAS ORGANIZAÇÕES\n');

  // 1. Verificar usuário logado
  console.log('1️⃣ Verificando usuário atual...');
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'teste@exemplo.co');
  
  if (!user) {
    console.log('❌ Usuário teste@exemplo.co não encontrado');
    return;
  }
  
  console.log(`✅ Usuário encontrado: ${user.email} (${user.id})`);

  // 2. Verificar organizações existentes
  console.log('\n2️⃣ Verificando organizações...');
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('*');

  console.log('Organizações:', orgs?.length || 0);
  if (orgsError) console.log('Erro:', orgsError);
  
  orgs?.forEach(org => {
    console.log(`   - ${org.name} (${org.id})`);
  });

  // 3. Verificar membership do usuário
  console.log('\n3️⃣ Verificando membership...');
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', user.id);

  console.log('Memberships:', membership?.length || 0);
  if (membershipError) console.log('Erro:', membershipError);
  
  membership?.forEach(m => {
    console.log(`   - Org: ${m.organization_id}, Role: ${m.role}, Status: ${m.status}`);
  });

  // 4. Testar API de organizações diretamente
  console.log('\n4️⃣ Testando API de organizações...');
  
  // Simular request com o usuário
  const mockRequest = {
    headers: new Headers(),
    json: async () => ({}),
    url: 'http://localhost:3000/api/organizations'
  };

  // Criar client com o usuário específico
  const userSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Fazer login
  const { data: session, error: loginError } = await userSupabase.auth.signInWithPassword({
    email: 'teste@exemplo.co',
    password: 'senha123'
  });

  if (loginError) {
    console.log('❌ Erro no login:', loginError.message);
    
    // Tentar resetar senha
    console.log('\n🔧 Tentando resetar senha...');
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: 'senha123'
    });
    
    if (updateError) {
      console.log('❌ Erro ao resetar senha:', updateError);
    } else {
      console.log('✅ Senha resetada para: senha123');
      
      // Tentar login novamente
      const { data: newSession, error: newLoginError } = await userSupabase.auth.signInWithPassword({
        email: 'teste@exemplo.co',
        password: 'senha123'
      });
      
      if (newLoginError) {
        console.log('❌ Ainda não consegue fazer login:', newLoginError.message);
      } else {
        console.log('✅ Login realizado com sucesso!');
      }
    }
  } else {
    console.log('✅ Login realizado com sucesso!');
  }

  // 5. Verificar se o problema é na API
  console.log('\n5️⃣ Verificando lógica da API...');
  
  if (membership && membership.length > 0) {
    const m = membership[0];
    const isSuperAdmin = m.role === 'super_admin' || 
                        m.role === 'owner' ||
                        user.email === 'lenine.engrene@gmail.com' ||
                        user.email === 'teste@exemplo.co';
    
    console.log(`Role: ${m.role}`);
    console.log(`Is Super Admin: ${isSuperAdmin}`);
    
    if (!isSuperAdmin) {
      console.log('❌ Usuário não é reconhecido como super admin!');
      
      // Corrigir role
      console.log('🔧 Corrigindo role para super_admin...');
      const { error: updateError } = await supabase
        .from('memberships')
        .update({ role: 'super_admin' })
        .eq('user_id', user.id);
      
      if (updateError) {
        console.log('❌ Erro ao atualizar role:', updateError);
      } else {
        console.log('✅ Role atualizada para super_admin!');
      }
    }
  } else {
    console.log('❌ Usuário não tem membership!');
    
    // Criar membership
    if (orgs && orgs.length > 0) {
      console.log('🔧 Criando membership...');
      const { error: createError } = await supabase
        .from('memberships')
        .insert({
          user_id: user.id,
          organization_id: orgs[0].id,
          org_id: orgs[0].id,
          role: 'super_admin',
          status: 'active',
          accepted_at: new Date().toISOString()
        });
      
      if (createError) {
        console.log('❌ Erro ao criar membership:', createError);
      } else {
        console.log('✅ Membership criada!');
      }
    }
  }

  console.log('\n✅ DIAGNÓSTICO CONCLUÍDO!');
  console.log('\n🚀 Agora tente fazer login novamente:');
  console.log('   Email: teste@exemplo.co');
  console.log('   Senha: senha123');
}

main().catch(console.error);