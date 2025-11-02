const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testarAPIExclusao() {
  try {
    console.log('🧪 TESTANDO API DE EXCLUSÃO DIRETAMENTE');
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
    
    // 2. Testar a API DELETE diretamente
    console.log('\n2️⃣ Testando API DELETE...');
    
    try {
      const response = await fetch(`http://localhost:3000/api/clients?id=${cliente.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      console.log(`📡 Status da resposta: ${response.status}`);
      
      const responseText = await response.text();
      console.log(`📄 Resposta completa: ${responseText}`);
      
      if (response.ok) {
        const data = JSON.parse(responseText);
        console.log('✅ API retornou sucesso:', data);
        
        // 3. Verificar se o cliente foi realmente excluído
        console.log('\n3️⃣ Verificando se cliente foi excluído...');
        const { data: clienteVerificacao, error: verificacaoError } = await supabase
          .from('clients')
          .select('id, name')
          .eq('id', cliente.id)
          .single();
          
        if (verificacaoError && verificacaoError.code === 'PGRST116') {
          console.log('✅ Cliente foi excluído com sucesso do banco!');
        } else if (clienteVerificacao) {
          console.log('❌ Cliente ainda existe no banco:', clienteVerificacao);
        } else {
          console.log('⚠️ Erro ao verificar:', verificacaoError);
        }
        
      } else {
        console.log('❌ API retornou erro:', response.status, responseText);
      }
      
    } catch (fetchError) {
      console.error('❌ Erro na requisição:', fetchError.message);
    }
    
    // 4. Verificar se há problemas de RLS
    console.log('\n4️⃣ Verificando políticas RLS...');
    const { data: rlsCheck, error: rlsError } = await supabase
      .from('clients')
      .select('id, name, org_id')
      .eq('id', cliente.id);
      
    if (rlsError) {
      console.log('❌ Erro RLS:', rlsError);
    } else {
      console.log('✅ RLS funcionando, cliente ainda visível:', rlsCheck?.length || 0);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testarAPIExclusao();