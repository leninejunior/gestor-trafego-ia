#!/usr/bin/env node

/**
 * Teste Real da Funcionalidade de Edição de Usuário
 * 
 * Este script testa:
 * 1. Carregamento da página de usuários
 * 2. Abertura do modal de detalhes
 * 3. Ativação do modo de edição
 * 4. Tentativa de salvar alterações
 * 5. Verificação de erros de autenticação
 */

const BASE_URL = 'http://localhost:3001';

async function testUserEdit() {
  console.log('🧪 TESTE REAL DA FUNCIONALIDADE DE EDIÇÃO DE USUÁRIO');
  console.log('=' .repeat(60));

  try {
    // 1. Testar se as APIs estão funcionando
    console.log('\n📋 1. TESTANDO APIS NECESSÁRIAS');
    
    // Testar API de listagem
    console.log('🔍 Testando API de listagem...');
    const listResponse = await fetch(`${BASE_URL}/api/admin/users/simple-test`);
    
    if (!listResponse.ok) {
      throw new Error(`API de listagem falhou: ${listResponse.status}`);
    }
    
    const listData = await listResponse.json();
    console.log('✅ API de listagem funcionando');
    console.log(`📊 ${listData.users.length} usuários encontrados`);
    
    if (listData.users.length === 0) {
      throw new Error('Nenhum usuário encontrado para testar');
    }
    
    const testUser = listData.users[0];
    console.log(`👤 Usuário de teste: ${testUser.email} (${testUser.id})`);

    // 2. Testar API enhanced (usada pelo modal)
    console.log('\n🔍 Testando API enhanced...');
    const enhancedResponse = await fetch(`${BASE_URL}/api/admin/users/enhanced`);
    
    console.log(`📡 Status da API enhanced: ${enhancedResponse.status}`);
    
    if (enhancedResponse.status === 401) {
      console.log('❌ API enhanced retornou 401 - Usuário não autenticado');
      console.log('🔍 Isso explica por que o modal não carrega dados corretamente');
    } else if (enhancedResponse.ok) {
      const enhancedData = await enhancedResponse.json();
      console.log('✅ API enhanced funcionando');
      console.log(`📊 ${enhancedData.users.length} usuários retornados`);
    } else {
      console.log(`❌ API enhanced falhou: ${enhancedResponse.status}`);
    }

    // 3. Testar API de atualização
    console.log('\n🔍 Testando API de atualização...');
    const updateData = {
      firstName: 'Test',
      lastName: 'Updated',
      email: testUser.email,
      phone: '(11) 99999-9999',
      role: 'member'
    };
    
    const updateResponse = await fetch(`${BASE_URL}/api/admin/users/${testUser.id}/update-simple`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    console.log(`📡 Status da API de atualização: ${updateResponse.status}`);
    
    if (updateResponse.status === 401) {
      console.log('❌ API de atualização retornou 401 - Usuário não autenticado');
      console.log('🔍 Isso explica o erro que você viu: "❌ Erro da API: {}"');
    } else if (updateResponse.ok) {
      const updateResult = await updateResponse.json();
      console.log('✅ API de atualização funcionando');
      console.log('📊 Resultado:', updateResult);
    } else {
      const errorText = await updateResponse.text();
      console.log(`❌ API de atualização falhou: ${updateResponse.status}`);
      console.log('📨 Resposta:', errorText);
    }

    // 4. Testar API de organizações
    console.log('\n🔍 Testando API de organizações...');
    const orgsResponse = await fetch(`${BASE_URL}/api/admin/organizations`);
    
    console.log(`📡 Status da API de organizações: ${orgsResponse.status}`);
    
    if (orgsResponse.status === 401) {
      console.log('❌ API de organizações retornou 401 - Usuário não autenticado');
    } else if (orgsResponse.ok) {
      const orgsData = await orgsResponse.json();
      console.log('✅ API de organizações funcionando');
      console.log(`📊 ${orgsData.organizations?.length || 0} organizações encontradas`);
    } else {
      console.log(`❌ API de organizações falhou: ${orgsResponse.status}`);
    }

    // 5. Análise do problema
    console.log('\n🔍 5. ANÁLISE DO PROBLEMA');
    console.log('=' .repeat(40));
    
    const issues = [];
    
    if (enhancedResponse.status === 401) {
      issues.push('API enhanced não autenticada - Modal não carrega dados');
    }
    
    if (updateResponse.status === 401) {
      issues.push('API de atualização não autenticada - Edição falha');
    }
    
    if (orgsResponse.status === 401) {
      issues.push('API de organizações não autenticada - Dropdown vazio');
    }

    if (issues.length > 0) {
      console.log('❌ PROBLEMAS IDENTIFICADOS:');
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
      
      console.log('\n💡 CAUSA RAIZ:');
      console.log('   O usuário não está autenticado quando acessa a página /admin/users');
      console.log('   Isso pode acontecer por:');
      console.log('   - Usuário não fez login');
      console.log('   - Session expirou');
      console.log('   - Cookies não estão sendo enviados');
      console.log('   - Middleware de autenticação não está funcionando');
      
      console.log('\n🔧 SOLUÇÕES POSSÍVEIS:');
      console.log('   1. Verificar se há middleware de autenticação na página');
      console.log('   2. Adicionar redirecionamento para login se não autenticado');
      console.log('   3. Verificar configuração do Supabase client');
      console.log('   4. Testar com usuário realmente logado');
      
    } else {
      console.log('✅ TODAS AS APIS FUNCIONANDO - Problema pode ser específico do frontend');
    }

    // 6. Instruções para teste manual
    console.log('\n📝 6. COMO TESTAR MANUALMENTE');
    console.log('=' .repeat(40));
    console.log('1. Abrir http://localhost:3001/admin/users');
    console.log('2. Verificar se aparece tela de login ou se carrega diretamente');
    console.log('3. Se carregar diretamente:');
    console.log('   - Clicar em "Ver ✅" em qualquer usuário');
    console.log('   - Verificar se o modal carrega dados');
    console.log('   - Clicar em "Editar ✏️"');
    console.log('   - Alterar algum campo');
    console.log('   - Clicar em "Salvar ✅"');
    console.log('   - Verificar se aparece erro de autenticação');
    console.log('4. Se aparecer tela de login:');
    console.log('   - Fazer login primeiro');
    console.log('   - Repetir passos 1-3');

  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
    console.log('\n🔧 VERIFICAÇÕES NECESSÁRIAS:');
    console.log('1. Servidor está rodando? npm run dev');
    console.log('2. Porta correta? http://localhost:3001');
    console.log('3. APIs existem nos arquivos?');
  }
}

// Executar teste
testUserEdit();