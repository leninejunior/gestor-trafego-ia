require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🧪 TESTANDO API /api/admin/plans');
console.log('=================================');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testarApiAdminPlans() {
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
    
    // 2. Verificar se é super admin
    console.log('\n👑 Verificando super admin...');
    const { data: superAdmin, error: superError } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', loginData.user.id)
      .eq('is_active', true)
      .single();
    
    if (superError) {
      console.log('❌ Erro ao verificar super admin:', superError.message);
    } else {
      console.log('✅ É super admin!');
      console.log('📋 Dados:', superAdmin);
    }
    
    // 3. Verificar tabelas que a API está tentando acessar
    console.log('\n📋 Verificando tabelas...');
    
    const tablesToCheck = [
      'profiles',
      'organization_memberships', 
      'admin_users',
      'subscription_plans'
    ];
    
    for (const table of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ Tabela ${table}: ${error.message}`);
        } else {
          console.log(`✅ Tabela ${table}: OK (${data?.length || 0} registros)`);
        }
      } catch (err) {
        console.log(`❌ Tabela ${table}: Erro inesperado`);
      }
    }
    
    // 4. Testar API /api/admin/plans
    console.log('\n🌐 Testando API /api/admin/plans...');
    
    const apiUrl = 'http://localhost:3000/api/admin/plans';
    
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📊 Status da resposta:', response.status);
      
      const responseText = await response.text();
      console.log('📄 Resposta bruta:', responseText);
      
      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          console.log('✅ API funcionou!');
          console.log('📋 Dados:', data);
          
          if (data.plans) {
            console.log(`📊 Planos encontrados: ${data.plans.length}`);
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
    }
    
    console.log('\n🎯 TESTE CONCLUÍDO!');
    
  } catch (error) {
    console.log('❌ Erro inesperado:', error.message);
  }
}

testarApiAdminPlans().catch(err => {
  console.log('❌ Erro na execução:', err.message);
});