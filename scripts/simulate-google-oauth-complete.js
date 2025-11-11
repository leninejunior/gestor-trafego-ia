/**
 * Simular processo OAuth Google completo
 * Para identificar onde está falhando
 */

const baseUrl = 'https://gestor.engrene.com';

async function simulateGoogleOAuthComplete() {
  console.log('🔄 SIMULANDO PROCESSO OAUTH GOOGLE COMPLETO');
  console.log('='.repeat(70));
  
  const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77';
  
  console.log('\n📋 CENÁRIO:');
  console.log('- Usuário clica em "Conectar Google Ads"');
  console.log('- Sistema inicia OAuth');
  console.log('- Google redireciona de volta');
  console.log('- Sistema deveria mostrar página de seleção de contas');
  
  try {
    console.log('\n🔍 ETAPA 1: Verificar se conseguimos acessar o dashboard Google');
    
    const dashboardUrl = `${baseUrl}/dashboard/google`;
    const dashboardResponse = await fetch(dashboardUrl);
    
    console.log('Status do dashboard:', dashboardResponse.status);
    
    if (dashboardResponse.ok) {
      console.log('✅ Dashboard acessível');
      
      // Verificar se há botão de conectar
      const dashboardHtml = await dashboardResponse.text();
      const hasConnectButton = dashboardHtml.includes('Conectar') || dashboardHtml.includes('Connect');
      console.log('- Tem botão conectar:', hasConnectButton);
      
    } else {
      console.log('❌ Dashboard não acessível');
    }
    
    console.log('\n🔍 ETAPA 2: Simular clique no botão "Conectar Google Ads"');
    
    // Isso normalmente faria uma requisição para /api/google/auth
    const authUrl = `${baseUrl}/api/google/auth?clientId=${clientId}`;
    console.log('URL que seria chamada:', authUrl);
    
    const authResponse = await fetch(authUrl);
    console.log('Status da auth:', authResponse.status);
    
    if (authResponse.status === 401) {
      console.log('⚠️ Usuário não está logado (normal em teste)');
      console.log('💡 Em uso real, usuário estaria logado e receberia URL OAuth');
    }
    
    console.log('\n🔍 ETAPA 3: Simular retorno do Google (callback)');
    
    // Simular callback com parâmetros válidos (mas sem autenticação)
    const callbackUrl = `${baseUrl}/api/google/callback?code=test_code&state=test_state`;
    console.log('URL de callback simulada:', callbackUrl);
    
    const callbackResponse = await fetch(callbackUrl);
    console.log('Status do callback:', callbackResponse.status);
    
    if (callbackResponse.status === 302 || callbackResponse.status === 307) {
      const location = callbackResponse.headers.get('location');
      console.log('✅ Callback redirecionou para:', location);
      
      if (location && location.includes('/google/select-accounts')) {
        console.log('🎯 SUCESSO! Redirecionamento para seleção de contas');
      } else if (location && location.includes('/auth/login')) {
        console.log('⚠️ Redirecionou para login (esperado sem autenticação)');
      } else {
        console.log('⚠️ Redirecionamento inesperado');
      }
    } else {
      console.log('⚠️ Callback não redirecionou (pode ser problema)');
      const callbackText = await callbackResponse.text();
      
      if (callbackText.includes('<!DOCTYPE html>')) {
        console.log('❌ Callback retornou HTML em vez de redirecionamento');
        console.log('Isso indica erro no processamento do callback');
      }
    }
    
    console.log('\n🔍 ETAPA 4: Verificar se página de seleção funciona');
    
    const selectUrl = `${baseUrl}/google/select-accounts?connectionId=test-id&clientId=${clientId}`;
    console.log('URL de seleção:', selectUrl);
    
    const selectResponse = await fetch(selectUrl);
    console.log('Status da seleção:', selectResponse.status);
    
    if (selectResponse.ok) {
      console.log('✅ Página de seleção carrega');
      
      const selectHtml = await selectResponse.text();
      const hasLoadingMessage = selectHtml.includes('Carregando contas') || selectHtml.includes('Loading');
      const hasErrorMessage = selectHtml.includes('Processo OAuth Incompleto');
      
      console.log('- Tem mensagem de carregamento:', hasLoadingMessage);
      console.log('- Tem mensagem de erro OAuth:', hasErrorMessage);
      
      if (hasErrorMessage) {
        console.log('💡 Página mostra que OAuth está incompleto');
        console.log('Isso confirma que não há conexão pendente criada');
      }
      
    } else {
      console.log('❌ Página de seleção não carrega');
    }
    
  } catch (error) {
    console.error('\n❌ ERRO NA SIMULAÇÃO:', error.message);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🏁 SIMULAÇÃO CONCLUÍDA');
  
  console.log('\n🎯 DIAGNÓSTICO:');
  console.log('Se você não chegou na página de seleção, o problema é:');
  console.log('1. OAuth não foi iniciado corretamente');
  console.log('2. Callback não processou corretamente');
  console.log('3. Conexão pendente não foi criada no banco');
  
  console.log('\n🔧 SOLUÇÃO:');
  console.log('1. Faça login no sistema');
  console.log('2. Vá para /dashboard/google');
  console.log('3. Clique em "Conectar Google Ads"');
  console.log('4. Complete o OAuth no Google');
  console.log('5. Deveria ser redirecionado para /google/select-accounts');
  
  console.log('\n💡 SE AINDA NÃO FUNCIONAR:');
  console.log('- Verifique os logs do navegador (F12 → Console)');
  console.log('- Verifique se há erros na aba Network');
  console.log('- Confirme se o callback está sendo chamado');
}

// Executar simulação
simulateGoogleOAuthComplete().catch(console.error);