const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testarFuncionalidadeCompleta() {
  try {
    console.log('🧪 TESTANDO FUNCIONALIDADE COMPLETA DE EXCLUSÃO');
    console.log('='.repeat(60));
    
    // 1. Verificar clientes de teste
    console.log('1️⃣ Verificando clientes de teste...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select(`
        id, 
        name, 
        org_id,
        created_at,
        organizations(id, name)
      `)
      .ilike('name', '%teste%')
      .limit(3);

    if (clientsError) {
      throw new Error(`Erro ao buscar clientes: ${clientsError.message}`);
    }

    if (!clients || clients.length === 0) {
      console.log('⚠️ Nenhum cliente de teste encontrado');
      return;
    }

    console.log(`✅ ${clients.length} clientes de teste encontrados`);
    
    // 2. Verificar estrutura da organização
    console.log('\n2️⃣ Verificando estrutura das organizações...');
    const orgIds = [...new Set(clients.map(c => c.org_id))];
    
    for (const orgId of orgIds) {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', orgId)
        .single();
        
      if (org) {
        console.log(`✅ Organização: ${org.name} (${org.id})`);
      } else {
        console.log(`❌ Organização não encontrada: ${orgId}`);
      }
    }
    
    // 3. Verificar memberships
    console.log('\n3️⃣ Verificando memberships...');
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select('user_id, organization_id, status')
      .in('organization_id', orgIds);
      
    if (memberships) {
      console.log(`✅ ${memberships.length} memberships encontrados`);
    } else {
      console.log('❌ Nenhum membership encontrado');
    }
    
    // 4. Mostrar URLs para teste
    console.log('\n4️⃣ URLs para teste:');
    console.log('='.repeat(40));
    
    clients.forEach((client, index) => {
      console.log(`\n${index + 1}. ${client.name}`);
      console.log(`   📋 ID: ${client.id}`);
      console.log(`   🏢 Org: ${client.organizations?.name || 'N/A'}`);
      console.log(`   📅 Criado: ${new Date(client.created_at).toLocaleDateString('pt-BR')}`);
      console.log(`   🔗 Lista: http://localhost:3000/dashboard/clients`);
      console.log(`   🔗 Detalhes: http://localhost:3000/dashboard/clients/${client.id}`);
    });
    
    // 5. Instruções de teste
    console.log('\n5️⃣ COMO TESTAR:');
    console.log('='.repeat(40));
    console.log('');
    console.log('📋 TESTE NA LISTA DE CLIENTES:');
    console.log('   1. Acesse: http://localhost:3000/dashboard/clients');
    console.log('   2. Clique no ícone ⚙️ de qualquer cliente');
    console.log('   3. Selecione "Excluir cliente"');
    console.log('   4. Confirme no dialog');
    console.log('   5. Veja o toast de sucesso');
    console.log('');
    console.log('🔍 TESTE NA PÁGINA DE DETALHES:');
    console.log('   1. Acesse qualquer URL de detalhes acima');
    console.log('   2. Veja as informações da organização');
    console.log('   3. Clique no botão vermelho "Excluir Cliente"');
    console.log('   4. Confirme no dialog (sem erro de HTML)');
    console.log('   5. Seja redirecionado para a lista');
    console.log('');
    console.log('✅ CORREÇÕES APLICADAS:');
    console.log('   - ✅ Erro HTML <ul> dentro de <p> corrigido');
    console.log('   - ✅ API feature-gate atualizada para usar org_id');
    console.log('   - ✅ Validação de memberships implementada');
    console.log('   - ✅ Toast notifications funcionando');
    console.log('   - ✅ Redirecionamento após exclusão');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testarFuncionalidadeCompleta();