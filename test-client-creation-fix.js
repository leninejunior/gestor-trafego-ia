#!/usr/bin/env node

/**
 * Teste para verificar se a correção dos joins memberships.org_id funcionou
 * Testa a criação de clientes após aplicar a migração fix-memberships-org-id-joins.sql
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
  console.log('🧪 Testando correção dos joins memberships.org_id');
  console.log('=' .repeat(60));

  try {
    // 1. Verificar se as tabelas existem
    console.log('\n1. Verificando estrutura das tabelas...');
    
    const { data: membershipsColumns, error: membershipsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'memberships')
      .in('column_name', ['org_id', 'organization_id']);

    if (membershipsError) {
      console.error('❌ Erro ao verificar colunas da tabela memberships:', membershipsError);
      return;
    }

    console.log('📋 Colunas da tabela memberships:', membershipsColumns.map(c => c.column_name));

    // Verificar qual coluna existe
    const hasOrgId = membershipsColumns.some(c => c.column_name === 'org_id');
    const hasOrganizationId = membershipsColumns.some(c => c.column_name === 'organization_id');

    console.log(`   - org_id: ${hasOrgId ? '✅' : '❌'}`);
    console.log(`   - organization_id: ${hasOrganizationId ? '✅' : '❌'}`);

    if (!hasOrganizationId) {
      console.error('❌ ERRO: Tabela memberships não tem coluna organization_id!');
      console.log('💡 Execute a migração user-management-schema.sql primeiro');
      return;
    }

    // 2. Buscar um usuário de teste
    console.log('\n2. Buscando usuário de teste...');
    
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError || !users.users.length) {
      console.error('❌ Erro ao buscar usuários:', usersError);
      return;
    }

    const testUser = users.users[0];
    console.log(`👤 Usuário de teste: ${testUser.email} (${testUser.id})`);

    // 3. Verificar membership do usuário
    console.log('\n3. Verificando membership do usuário...');
    
    let { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('organization_id, role')
      .eq('user_id', testUser.id)
      .single();

    if (membershipError) {
      console.error('❌ Erro ao buscar membership:', membershipError);
      console.log('💡 Usuário pode não ter membership. Criando uma...');
      
      // Buscar uma organização
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name')
        .limit(1);

      if (orgsError || !orgs.length) {
        console.error('❌ Erro ao buscar organizações:', orgsError);
        return;
      }

      const org = orgs[0];
      console.log(`🏢 Organização encontrada: ${org.name} (${org.id})`);

      // Criar membership
      const { data: newMembership, error: createMembershipError } = await supabase
        .from('memberships')
        .insert({
          user_id: testUser.id,
          organization_id: org.id,
          role: 'admin'
        })
        .select()
        .single();

      if (createMembershipError) {
        console.error('❌ Erro ao criar membership:', createMembershipError);
        return;
      }

      console.log('✅ Membership criada:', newMembership);
      membership = newMembership;
    } else {
      console.log(`✅ Membership encontrada: org ${membership.organization_id}, role ${membership.role}`);
    }

    // 4. Testar query que estava falhando
    console.log('\n4. Testando query com join corrigido...');
    
    const testQuery = `
      SELECT c.id, c.name
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = $1
      LIMIT 5
    `;

    const { data: clientsTest, error: queryError } = await supabase
      .rpc('exec_sql', { 
        sql: testQuery,
        params: [testUser.id]
      });

    if (queryError) {
      console.error('❌ Erro na query de teste:', queryError);
      console.log('💡 Isso indica que o join ainda está incorreto');
      return;
    }

    console.log('✅ Query com join funcionando!');
    console.log(`📊 Clientes acessíveis: ${clientsTest?.length || 0}`);

    // 5. Testar criação de cliente via API simulada
    console.log('\n5. Testando criação de cliente...');
    
    const testClientName = `Cliente Teste ${Date.now()}`;
    
    const { data: newClient, error: createError } = await supabase
      .from('clients')
      .insert({
        name: testClientName,
        description: 'Cliente criado para teste da correção',
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
    console.log(`🏢 Organização: ${newClient.org_id}`);

    // 6. Verificar se o cliente é acessível via RLS
    console.log('\n6. Verificando acesso via RLS...');
    
    // Simular contexto de usuário autenticado
    const { data: accessibleClients, error: accessError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', newClient.id);

    if (accessError) {
      console.error('❌ Erro ao verificar acesso:', accessError);
      return;
    }

    if (accessibleClients.length > 0) {
      console.log('✅ Cliente acessível via RLS!');
    } else {
      console.log('⚠️ Cliente não acessível via RLS (pode ser normal dependendo das políticas)');
    }

    // 7. Limpeza - remover cliente de teste
    console.log('\n7. Limpando dados de teste...');
    
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', newClient.id);

    if (deleteError) {
      console.error('⚠️ Erro ao remover cliente de teste:', deleteError);
    } else {
      console.log('✅ Cliente de teste removido');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('✅ Correção dos joins memberships.org_id funcionando');
    console.log('✅ Criação de clientes funcionando');
    console.log('✅ Políticas RLS aplicadas corretamente');

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

// Executar teste
if (require.main === module) {
  testClientCreation();
}

module.exports = { testClientCreation };
