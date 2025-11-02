require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🧪 TESTANDO API /api/organizations');
console.log('==================================');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testarApiOrganizations() {
  try {
    const emailLenine = 'lenine.engrene@gmail.com';
    
    // 1. Fazer login
    console.log('🔐 Fazendo login...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: emailLenine,
      password: 'senha123'
    });
    
    if (loginError) {
      console.log('❌ Erro no login:', loginError.message);
      return;
    }
    
    console.log('✅ Login realizado com sucesso!');
    console.log('🆔 User ID:', loginData.user.id);
    
    // 2. Obter token de acesso
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('❌ Sessão não encontrada');
      return;
    }
    
    console.log('🎫 Token obtido');
    
    // 3. Testar API /api/organizations
    console.log('\n🌐 Testando API /api/organizations...');
    
    const apiUrl = 'http://localhost:3000/api/organizations';
    
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📊 Status da resposta:', response.status);
      console.log('📋 Headers da resposta:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('📄 Resposta bruta:', responseText);
      
      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          console.log('✅ API funcionou!');
          console.log('🏢 Organizações encontradas:', data.organizations?.length || 0);
          
          if (data.organizations && data.organizations.length > 0) {
            data.organizations.forEach((org, index) => {
              console.log(`  ${index + 1}. ${org.name} (${org.memberships?.[0]?.count || 0} membros)`);
            });
          }
        } catch (parseError) {
          console.log('⚠️  Resposta não é JSON válido:', parseError.message);
        }
      } else {
        console.log('❌ API retornou erro:', response.status);
        console.log('📄 Mensagem:', responseText);
      }
      
    } catch (fetchError) {
      console.log('❌ Erro na requisição:', fetchError.message);
      
      // Tentar sem token (para debug)
      console.log('\n🔄 Tentando sem token...');
      
      try {
        const responseNoAuth = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📊 Status sem auth:', responseNoAuth.status);
        const textNoAuth = await responseNoAuth.text();
        console.log('📄 Resposta sem auth:', textNoAuth);
        
      } catch (noAuthError) {
        console.log('❌ Erro sem auth:', noAuthError.message);
      }
    }
    
    // 4. Testar acesso direto ao Supabase
    console.log('\n🔍 Testando acesso direto ao Supabase...');
    
    const { data: directOrgs, error: directError } = await supabase
      .from('organizations')
      .select('*');
    
    if (directError) {
      console.log('❌ Erro no acesso direto:', directError.message);
    } else {
      console.log(`✅ Acesso direto funcionou! (${directOrgs.length} organizações)`);
    }
    
    // 5. Testar verificação de super admin
    console.log('\n👑 Testando verificação de super admin...');
    
    const { data: superAdminCheck, error: superError } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', loginData.user.id)
      .eq('is_active', true)
      .single();
    
    if (superError) {
      console.log('❌ Erro na verificação de super admin:', superError.message);
    } else {
      console.log('✅ Verificação de super admin passou!');
      console.log('📋 Dados:', superAdminCheck);
    }
    
    console.log('\n🎯 TESTE CONCLUÍDO!');
    console.log('===================');
    
  } catch (error) {
    console.log('❌ Erro inesperado:', error.message);
  }
}

testarApiOrganizations().catch(err => {
  console.log('❌ Erro na execução:', err.message);
});