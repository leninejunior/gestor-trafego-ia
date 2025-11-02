const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugExclusaoFrontend() {
  try {
    console.log('🔍 DEBUG: EXCLUSÃO FRONTEND');
    console.log('='.repeat(50));
    
    // 1. Listar clientes restantes
    console.log('1️⃣ Clientes restantes no banco...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, org_id')
      .ilike('name', '%teste%');

    if (clientsError) {
      console.error('❌ Erro ao buscar clientes:', clientsError);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('✅ Nenhum cliente de teste restante - todos foram excluídos!');
      return;
    }

    console.log(`📋 ${clients.length} clientes restantes:`);
    clients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.name} (${client.id.slice(0, 8)}...)`);
    });

    // 2. Testar exclusão de um cliente específico
    const clienteTeste = clients[0];
    console.log(`\n2️⃣ Testando exclusão do cliente: ${clienteTeste.name}`);
    
    // Simular requisição do frontend com diferentes cenários
    const testCases = [
      {
        name: 'Sem credentials',
        options: {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        }
      },
      {
        name: 'Com credentials',
        options: {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        }
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n🧪 Teste: ${testCase.name}`);
      try {
        const response = await fetch(`http://localhost:3000/api/clients?id=${clienteTeste.id}`, testCase.options);
        console.log(`   Status: ${response.status}`);
        
        const responseText = await response.text();
        console.log(`   Response: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);
        
        if (response.status === 200) {
          console.log('   ✅ Sucesso - cliente deve ter sido excluído');
          break; // Parar nos testes se um funcionou
        } else {
          console.log(`   ❌ Falhou com status ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Erro na requisição: ${error.message}`);
      }
    }

    // 3. Verificar se o cliente ainda existe após os testes
    console.log('\n3️⃣ Verificando se cliente ainda existe...');
    const { data: clienteVerificacao, error: verificacaoError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clienteTeste.id)
      .single();
      
    if (verificacaoError && verificacaoError.code === 'PGRST116') {
      console.log('✅ Cliente foi excluído com sucesso!');
    } else if (clienteVerificacao) {
      console.log('❌ Cliente ainda existe no banco');
    } else {
      console.log('⚠️ Erro ao verificar:', verificacaoError);
    }

    // 4. Instruções para debug no frontend
    console.log('\n4️⃣ INSTRUÇÕES PARA DEBUG NO FRONTEND:');
    console.log('='.repeat(50));
    console.log('1. Abra o DevTools (F12)');
    console.log('2. Vá para a aba Console');
    console.log('3. Cole este código para testar diretamente:');
    console.log('');
    console.log(`fetch('/api/clients?id=${clienteTeste.id}', {`);
    console.log('  method: "DELETE",');
    console.log('  credentials: "include",');
    console.log('  headers: { "Content-Type": "application/json" }');
    console.log('}).then(r => r.json()).then(console.log).catch(console.error)');
    console.log('');
    console.log('4. Verifique se retorna sucesso ou erro');
    console.log('5. Se retornar erro 401, o problema é autenticação');
    console.log('6. Se retornar erro 403, o problema é autorização');
    console.log('7. Se retornar erro 404, o cliente não existe');
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

debugExclusaoFrontend();