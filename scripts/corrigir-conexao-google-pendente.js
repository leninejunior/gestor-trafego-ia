/**
 * Script para corrigir conexão Google pendente e mostrar opção de selecionar contas
 */

require('dotenv').config();

async function corrigirConexaoGooglePendente() {
  console.log('='.repeat(80));
  console.log('🔧 CORRIGINDO CONEXÃO GOOGLE PENDENTE');
  console.log('Timestamp:', new Date().toISOString());
  console.log('='.repeat(80));

  const baseUrl = 'http://localhost:3000';
  const connectionId = '6d1fadb2-715b-45ea-8d1d-08c43b5a2bf3';
  const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77';

  try {
    console.log('\n1️⃣ SITUAÇÃO ATUAL:');
    console.log('📋 Connection ID:', connectionId);
    console.log('📋 Client ID:', clientId);
    console.log('📋 Status: PENDENTE (precisa selecionar contas)');
    console.log('📋 Problema: Dashboard mostra como "desconectado"');

    // 2. Testar API de contas para ver se consegue listar
    console.log('\n2️⃣ TESTANDO API DE CONTAS...');
    
    const accountsUrl = `${baseUrl}/api/google/accounts?connectionId=${connectionId}&clientId=${clientId}`;
    console.log('📡 URL da API:', accountsUrl);
    
    try {
      const accountsResponse = await fetch(accountsUrl);
      console.log('📊 Status da API:', accountsResponse.status, accountsResponse.statusText);
      
      const accountsData = await accountsResponse.json();
      console.log('📋 Resposta da API:');
      console.log(JSON.stringify(accountsData, null, 2));
      
      if (accountsResponse.ok) {
        if (accountsData.accounts && accountsData.accounts.length > 0) {
          console.log('\n✅ CONTAS ENCONTRADAS! Sistema híbrido funcionando:');
          console.log(`   • Total de contas: ${accountsData.accounts.length}`);
          console.log(`   • Contas MCC: ${accountsData.accounts.filter(acc => acc.canManageClients).length}`);
          console.log(`   • Contas diretas/gerenciadas: ${accountsData.accounts.filter(acc => !acc.canManageClients).length}`);
          
          console.log('\n📋 SUAS CONTAS GOOGLE ADS:');
          accountsData.accounts.forEach((account, index) => {
            const tipo = account.canManageClients ? '[MCC]' : '[DIRETA]';
            console.log(`   ${index + 1}. ${account.descriptiveName} (${account.customerId}) ${tipo}`);
          });
          
          console.log('\n🎯 SOLUÇÃO:');
          console.log('   1. Acesse: http://localhost:3000/google/select-accounts');
          console.log('   2. Selecione as contas que deseja conectar');
          console.log('   3. Após selecionar, a conexão ficará ativa no dashboard');
          
        } else if (accountsData.isPending) {
          console.log('\n⚠️ CONEXÃO PENDENTE - PRECISA COMPLETAR OAUTH');
          console.log('   Motivo:', accountsData.message || 'OAuth incompleto');
          
          console.log('\n🔧 SOLUÇÕES POSSÍVEIS:');
          console.log('   1. Token expirado - Reconectar:');
          console.log('      → http://localhost:3000/dashboard/google');
          console.log('      → Clique em "Conectar Google Ads" novamente');
          console.log('');
          console.log('   2. Ou completar processo existente:');
          console.log('      → http://localhost:3000/google/select-accounts');
          console.log('      → Se der erro, use a opção 1');
        }
      } else {
        console.log('\n❌ ERRO NA API:', accountsData.error || 'Erro desconhecido');
      }
    } catch (accountsError) {
      console.error('❌ Erro ao testar API de contas:', accountsError.message);
    }

    // 3. Verificar se a página de seleção funciona
    console.log('\n3️⃣ TESTANDO PÁGINA DE SELEÇÃO DE CONTAS...');
    const selectUrl = `${baseUrl}/google/select-accounts?connectionId=${connectionId}`;
    console.log('📡 URL de seleção:', selectUrl);
    
    try {
      const selectResponse = await fetch(selectUrl);
      console.log('📊 Status da página de seleção:', selectResponse.status);
      
      if (selectResponse.ok) {
        console.log('✅ Página de seleção acessível');
        console.log('💡 Você pode acessar diretamente para completar a conexão');
      } else {
        console.log('❌ Problema na página de seleção');
        console.log('💡 Use a opção de reconectar no dashboard');
      }
    } catch (selectError) {
      console.log('❌ Erro na página de seleção:', selectError.message);
    }

    // 4. Instruções finais baseadas no diagnóstico
    console.log('\n4️⃣ RESUMO E SOLUÇÕES:');
    
    console.log('\n🔍 PROBLEMA IDENTIFICADO:');
    console.log('   • Conexão existe no banco de dados');
    console.log('   • Status está como "pending" (aguardando seleção)');
    console.log('   • Dashboard interpreta como "desconectado"');
    console.log('   • Precisa completar o processo de seleção de contas');
    
    console.log('\n💡 SOLUÇÕES (em ordem de preferência):');
    console.log('');
    console.log('🥇 OPÇÃO 1 - COMPLETAR PROCESSO EXISTENTE:');
    console.log('   1. Acesse: http://localhost:3000/google/select-accounts');
    console.log('   2. Se funcionar, selecione suas contas');
    console.log('   3. Conexão ficará ativa no dashboard');
    console.log('');
    console.log('🥈 OPÇÃO 2 - RECONECTAR (se opção 1 falhar):');
    console.log('   1. Acesse: http://localhost:3000/dashboard/google');
    console.log('   2. Clique em "Conectar Google Ads"');
    console.log('   3. Refaça o OAuth completo');
    console.log('   4. Selecione suas contas');
    console.log('');
    console.log('🥉 OPÇÃO 3 - LIMPAR E RECONECTAR:');
    console.log('   1. Delete a conexão existente no banco');
    console.log('   2. Crie uma nova conexão do zero');

    console.log('\n🎯 APÓS COMPLETAR QUALQUER OPÇÃO:');
    console.log('   ✅ Dashboard mostrará conexão como "ativa"');
    console.log('   ✅ Sistema híbrido funcionará perfeitamente');
    console.log('   ✅ Você verá suas contas MCC + gerenciadas ou diretas');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }

  console.log('\n' + '='.repeat(80));
}

corrigirConexaoGooglePendente();