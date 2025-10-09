// Script para testar as operações de DELETE após aplicar as correções RLS
// Execute: node scripts/test-delete-connections.js

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDeleteOperations() {
  console.log('🧪 Testando operações de DELETE...\n');

  try {
    // 1. Listar conexões existentes
    console.log('1. Listando conexões existentes...');
    const { data: connections, error: listError } = await supabase
      .from('client_meta_connections')
      .select('*');

    if (listError) {
      console.error('❌ Erro ao listar conexões:', listError.message);
      return;
    }

    console.log(`✅ Encontradas ${connections?.length || 0} conexões`);
    
    if (!connections || connections.length === 0) {
      console.log('ℹ️  Nenhuma conexão encontrada para testar');
      return;
    }

    // 2. Testar DELETE de uma conexão específica
    const testConnection = connections[0];
    console.log(`\n2. Testando DELETE da conexão: ${testConnection.id}`);
    
    const { data: deleteData, error: deleteError } = await supabase
      .from('client_meta_connections')
      .delete()
      .eq('id', testConnection.id)
      .select();

    if (deleteError) {
      console.error('❌ Erro ao deletar conexão:', deleteError.message);
      console.error('Código do erro:', deleteError.code);
      console.error('Detalhes:', deleteError.details);
    } else {
      console.log('✅ DELETE executado com sucesso');
      console.log('Registros deletados:', deleteData?.length || 0);
      
      if (deleteData && deleteData.length > 0) {
        console.log('✅ Conexão realmente deletada!');
      } else {
        console.log('⚠️  DELETE retornou sucesso mas nenhum registro foi afetado');
        console.log('   Isso indica problema de RLS (Row Level Security)');
      }
    }

    // 3. Verificar se a conexão ainda existe
    console.log('\n3. Verificando se a conexão ainda existe...');
    const { data: checkData, error: checkError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('id', testConnection.id);

    if (checkError) {
      console.error('❌ Erro ao verificar conexão:', checkError.message);
    } else {
      if (checkData && checkData.length > 0) {
        console.log('⚠️  Conexão ainda existe no banco (DELETE não funcionou)');
      } else {
        console.log('✅ Conexão foi realmente removida do banco');
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar teste
testDeleteOperations()
  .then(() => {
    console.log('\n🏁 Teste concluído');
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
  });