#!/usr/bin/env node

/**
 * Teste simples para verificar se a criação de clientes está funcionando
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase via ambiente
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis ausentes: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_KEY).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testClientCreation() {
  console.log('🧪 Teste Simples: Criação de Cliente');
  console.log('=' .repeat(50));

  try {
    // 1. Buscar um usuário existente
    console.log('\n1. Buscando usuário...');
    
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError || !users.users.length) {
      console.error('❌ Erro ao buscar usuários:', usersError);
      return;
    }

    const testUser = users.users[0];
    console.log(`👤 Usuário: ${testUser.email}`);

    // 2. Buscar membership do usuário
    console.log('\n2. Verificando membership...');
    
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('organization_id, role')
      .eq('user_id', testUser.id)
      .single();

    if (membershipError) {
      console.error('❌ Erro ao buscar membership:', membershipError);
      return;
    }

    console.log(`✅ Membership: org ${membership.organization_id}, role ${membership.role}`);

    // 3. Testar criação de cliente
    console.log('\n3. Criando cliente de teste...');
    
    const testClientName = `Cliente Teste ${Date.now()}`;
    
    const { data: newClient, error: createError } = await supabase
      .from('clients')
      .insert({
        name: testClientName,
        description: 'Cliente criado para teste',
        org_id: membership.organization_id,
        created_by: testUser.id
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Erro ao criar cliente:', createError);
      return;
    }

    console.log('✅ Cliente criado com sucesso!');
    console.log(`📝 Nome: ${newClient.name}`);
    console.log(`🆔 ID: ${newClient.id}`);

    // 4. Testar query que estava falhando antes
    console.log('\n4. Testando query com join...');
    
    const { data: clientsViaJoin, error: joinError } = await supabase
      .from('clients')
      .select(`
        id, 
        name,
        memberships!inner(user_id, organization_id)
      `)
      .eq('memberships.user_id', testUser.id)
      .eq('id', newClient.id);

    if (joinError) {
      console.error('❌ Erro na query com join:', joinError);
    } else {
      console.log('✅ Query com join funcionando!');
      console.log(`📊 Resultado: ${clientsViaJoin.length} cliente(s) encontrado(s)`);
    }

    // 5. Limpeza
    console.log('\n5. Removendo cliente de teste...');
    
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', newClient.id);

    if (deleteError) {
      console.error('⚠️ Erro ao remover cliente:', deleteError);
    } else {
      console.log('✅ Cliente removido');
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('✅ Criação de clientes funcionando');

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

// Executar teste
testClientCreation();
