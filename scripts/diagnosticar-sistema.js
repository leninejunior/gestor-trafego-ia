require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configurações do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Diagnóstico do Sistema');
console.log('========================');

// Verificar variáveis de ambiente
console.log('\n📋 Variáveis de Ambiente:');
console.log('SUPABASE_URL:', supabaseUrl ? '✅ Definida' : '❌ Não definida');
console.log('SUPABASE_ANON_KEY:', supabaseKey ? '✅ Definida' : '❌ Não definida');

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Variáveis de ambiente não configuradas corretamente');
  process.exit(1);
}

// Criar cliente Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosticar() {
  try {
    console.log('\n🔗 Testando conexão com Supabase...');
    
    // Testar conexão básica
    const { data, error } = await supabase.from('organizations').select('count').limit(1);
    
    if (error) {
      console.log('❌ Erro na conexão:', error.message);
      
      // Verificar se é problema de RLS
      if (error.message.includes('RLS') || error.message.includes('policy')) {
        console.log('🔒 Problema relacionado a Row Level Security (RLS)');
      }
      
      // Verificar se é problema de autenticação
      if (error.message.includes('JWT') || error.message.includes('token')) {
        console.log('🔑 Problema relacionado a autenticação/token');
      }
    } else {
      console.log('✅ Conexão com Supabase funcionando');
    }

    // Testar autenticação
    console.log('\n🔐 Testando sistema de autenticação...');
    const { data: session } = await supabase.auth.getSession();
    console.log('Sessão atual:', session.session ? '✅ Ativa' : '❌ Não encontrada');

    // Verificar tabelas principais
    console.log('\n📊 Verificando tabelas principais...');
    
    const tabelas = ['organizations', 'clients', 'memberships', 'client_meta_connections'];
    
    for (const tabela of tabelas) {
      try {
        const { error } = await supabase.from(tabela).select('count').limit(1);
        if (error) {
          console.log(`❌ ${tabela}: ${error.message}`);
        } else {
          console.log(`✅ ${tabela}: Acessível`);
        }
      } catch (err) {
        console.log(`❌ ${tabela}: Erro inesperado - ${err.message}`);
      }
    }

  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

diagnosticar().then(() => {
  console.log('\n✅ Diagnóstico concluído');
}).catch(err => {
  console.log('❌ Erro no diagnóstico:', err.message);
});