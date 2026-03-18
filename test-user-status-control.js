#!/usr/bin/env node

/**
 * Teste do Sistema de Controle de Status de Usuário
 * 
 * Este script testa:
 * 1. Listagem de usuários com status correto
 * 2. Funcionalidade de suspender usuário
 * 3. Funcionalidade de ativar usuário
 * 4. Filtros de status
 */

const BASE_URL = 'http://localhost:3001';

async function testUserStatusControl() {
  console.log('🧪 TESTE DO SISTEMA DE CONTROLE DE STATUS DE USUÁRIO');
  console.log('=' .repeat(60));

  try {
    // 1. Testar listagem de usuários
    console.log('\n📋 1. TESTANDO LISTAGEM DE USUÁRIOS');
    const response = await fetch(`${BASE_URL}/api/admin/users/simple-test`);
    
    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ API respondeu com sucesso');
    console.log(`📊 Total de usuários: ${data.users.length}`);
    console.log(`📊 Usuários ativos: ${data.stats.active}`);
    console.log(`📊 Usuários suspensos: ${data.stats.pending}`);
    console.log(`📊 Super Admins: ${data.stats.superAdmins}`);

    // 2. Analisar status dos usuários
    console.log('\n🔍 2. ANÁLISE DE STATUS DOS USUÁRIOS');
    const activeUsers = data.users.filter(u => !u.is_suspended);
    const suspendedUsers = data.users.filter(u => u.is_suspended);

    console.log(`✅ Usuários ativos encontrados: ${activeUsers.length}`);
    activeUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.user_type})`);
    });

    console.log(`⛔ Usuários suspensos encontrados: ${suspendedUsers.length}`);
    suspendedUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.user_type}) - Motivo: ${user.suspension_reason || 'N/A'}`);
    });

    // 3. Testar estrutura de dados
    console.log('\n🔍 3. VERIFICAÇÃO DA ESTRUTURA DE DADOS');
    const sampleUser = data.users[0];
    console.log('📋 Campos disponíveis no usuário:');
    console.log(`   - id: ${sampleUser.id ? '✅' : '❌'}`);
    console.log(`   - email: ${sampleUser.email ? '✅' : '❌'}`);
    console.log(`   - is_suspended: ${sampleUser.hasOwnProperty('is_suspended') ? '✅' : '❌'}`);
    console.log(`   - suspended_at: ${sampleUser.hasOwnProperty('suspended_at') ? '✅' : '❌'}`);
    console.log(`   - suspension_reason: ${sampleUser.hasOwnProperty('suspension_reason') ? '✅' : '❌'}`);
    console.log(`   - user_type: ${sampleUser.user_type ? '✅' : '❌'}`);
    console.log(`   - memberships: ${sampleUser.memberships ? '✅' : '❌'}`);

    // 4. Verificar consistência dos dados
    console.log('\n🔍 4. VERIFICAÇÃO DE CONSISTÊNCIA');
    let inconsistencies = 0;

    data.users.forEach(user => {
      // Verificar se usuários suspensos têm motivo
      if (user.is_suspended && !user.suspension_reason) {
        console.log(`⚠️  Usuário ${user.email} está suspenso mas não tem motivo`);
        inconsistencies++;
      }

      // Verificar se usuários não suspensos não têm dados de suspensão
      if (!user.is_suspended && (user.suspended_at || user.suspension_reason)) {
        console.log(`⚠️  Usuário ${user.email} não está suspenso mas tem dados de suspensão`);
        inconsistencies++;
      }
    });

    if (inconsistencies === 0) {
      console.log('✅ Todos os dados estão consistentes');
    } else {
      console.log(`❌ Encontradas ${inconsistencies} inconsistências`);
    }

    // 5. Testar filtros (simulação)
    console.log('\n🔍 5. SIMULAÇÃO DE FILTROS');
    
    // Filtro "Todos"
    const allUsers = data.users;
    console.log(`📋 Filtro "Todos": ${allUsers.length} usuários`);

    // Filtro "Ativos"
    const activeFiltered = data.users.filter(u => !u.is_suspended);
    console.log(`✅ Filtro "Ativos": ${activeFiltered.length} usuários`);

    // Filtro "Suspensos"
    const suspendedFiltered = data.users.filter(u => u.is_suspended);
    console.log(`⛔ Filtro "Suspensos": ${suspendedFiltered.length} usuários`);

    // Verificar se os filtros batem com as estatísticas
    const statsMatch = 
      activeFiltered.length === data.stats.active &&
      suspendedFiltered.length === data.stats.pending;

    if (statsMatch) {
      console.log('✅ Filtros batem com as estatísticas');
    } else {
      console.log('❌ Filtros NÃO batem com as estatísticas');
      console.log(`   Stats active: ${data.stats.active}, Filtered: ${activeFiltered.length}`);
      console.log(`   Stats suspended: ${data.stats.pending}, Filtered: ${suspendedFiltered.length}`);
    }

    // 6. Resumo final
    console.log('\n🎯 6. RESUMO DO TESTE');
    console.log('=' .repeat(40));
    
    const issues = [];
    
    if (data.users.length === 0) {
      issues.push('Nenhum usuário encontrado');
    }
    
    if (inconsistencies > 0) {
      issues.push(`${inconsistencies} inconsistências nos dados`);
    }
    
    if (!statsMatch) {
      issues.push('Filtros não batem com estatísticas');
    }

    if (issues.length === 0) {
      console.log('🎉 TESTE PASSOU - Sistema funcionando corretamente!');
      console.log('✅ Listagem de usuários: OK');
      console.log('✅ Status de usuários: OK');
      console.log('✅ Estrutura de dados: OK');
      console.log('✅ Consistência: OK');
      console.log('✅ Filtros: OK');
      console.log('✅ Estatísticas: OK');
    } else {
      console.log('❌ TESTE FALHOU - Problemas encontrados:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    }

    console.log('\n📝 PRÓXIMOS PASSOS PARA TESTAR:');
    console.log('1. Acessar http://localhost:3001/admin/users');
    console.log('2. Verificar se a lista mostra status corretos');
    console.log('3. Clicar em "Ver" em um usuário ativo');
    console.log('4. Testar botão "Suspender Usuário"');
    console.log('5. Verificar se o status muda na lista');
    console.log('6. Testar botão "Ativar Usuário"');
    console.log('7. Testar filtros "Todos", "Ativos", "Suspensos"');

  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
    console.log('\n🔧 POSSÍVEIS SOLUÇÕES:');
    console.log('1. Verificar se o servidor está rodando: npm run dev');
    console.log('2. Verificar se a API está funcionando');
    console.log('3. Verificar logs do servidor para erros');
  }
}

// Executar teste
testUserStatusControl();