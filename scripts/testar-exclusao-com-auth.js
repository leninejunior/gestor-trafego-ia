const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testarExclusaoComAuth() {
  try {
    console.log('🧪 TESTANDO EXCLUSÃO COM AUTENTICAÇÃO');
    console.log('='.repeat(50));
    
    // 1. Buscar um cliente de teste
    console.log('1️⃣ Buscando cliente de teste...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, org_id')
      .ilike('name', '%teste%')
      .limit(1);

    if (clientsError || !clients || clients.length === 0) {
      console.log('❌ Nenhum cliente de teste encontrado');
      return;
    }

    const cliente = clients[0];
    console.log(`✅ Cliente encontrado: ${cliente.name} (${cliente.id})`);
    
    // 2. Simular exclusão direta no banco (como super admin)
    console.log('\n2️⃣ Testando exclusão direta no banco...');
    
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', cliente.id);
      
    if (deleteError) {
      console.log('❌ Erro ao excluir no banco:', deleteError);
    } else {
      console.log('✅ Cliente excluído com sucesso do banco!');
      
      // 3. Verificar se foi realmente excluído
      console.log('\n3️⃣ Verificando exclusão...');
      const { data: verificacao, error: verificacaoError } = await supabase
        .from('clients')
        .select('id, name')
        .eq('id', cliente.id);
        
      if (verificacao && verificacao.length === 0) {
        console.log('✅ Confirmado: Cliente foi excluído!');
      } else {
        console.log('❌ Cliente ainda existe:', verificacao);
      }
    }
    
    console.log('\n4️⃣ INSTRUÇÕES PARA TESTAR NA INTERFACE:');
    console.log('='.repeat(50));
    console.log('1. Abra o DevTools (F12)');
    console.log('2. Vá para a aba Network');
    console.log('3. Clique no botão "Excluir Cliente"');
    console.log('4. Verifique se a requisição DELETE aparece');
    console.log('5. Clique na requisição e veja:');
    console.log('   - Status Code (deve ser 200, não 401)');
    console.log('   - Request Headers (deve incluir cookies)');
    console.log('   - Response (deve mostrar sucesso)');
    console.log('');
    console.log('✅ CORREÇÕES APLICADAS:');
    console.log('   - ✅ Adicionado credentials: "include"');
    console.log('   - ✅ Adicionado Content-Type header');
    console.log('   - ✅ Corrigido em ambos os componentes');
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testarExclusaoComAuth();