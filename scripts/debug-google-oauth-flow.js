/**
 * Debug do Fluxo OAuth Google Completo
 * Identifica onde o fluxo está falhando
 */

const baseUrl = 'https://gestor.engrene.com';

async function debugGoogleOAuthFlow() {
  console.log('🔍 DEBUG DO FLUXO OAUTH GOOGLE COMPLETO');
  console.log('='.repeat(70));
  
  const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77';
  
  console.log('\n📋 DADOS DO TESTE:');
  console.log('- Client ID:', clientId);
  console.log('- Base URL:', baseUrl);
  
  try {
    console.log('\n🔍 PASSO 1: Verificar se conseguimos acessar a API de auth');
    
    const authUrl = `${baseUrl}/api/google/auth?clientId=${clientId}`;
    console.log('URL de auth:', authUrl);
    
    const authResponse = await fetch(authUrl);
    console.log('Status da auth:', authResponse.status);
    
    if (authResponse.status === 401) {
      console.log('⚠️ Precisa estar logado (esperado)');
    } else if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log('✅ Auth URL gerada:', !!authData.authUrl);
      console.log('- URL OAuth:', authData.authUrl?.substring(0, 100) + '...');
    } else {
      const authError = await authResponse.text();
      console.log('❌ Erro na auth:', authError.substring(0, 200));
    }
    
    console.log('\n🔍 PASSO 2: Verificar se existem conexões Google pendentes');
    
    // Vamos verificar se há conexões pendentes no banco
    const debugUrl = `${baseUrl}/api/debug/check-pending-connections?clientId=${clientId}`;
    console.log('URL de debug:', debugUrl);
    
    const debugResponse = await fetch(debugUrl);
    console.log('Status do debug:', debugResponse.status);
    
    if (debugResponse.status === 404) {
      console.log('⚠️ API de debug não existe (normal)');
    } else if (debugResponse.ok) {
      const debugData = await debugResponse.json();
      console.log('✅ Dados de debug:', debugData);
    }
    
    console.log('\n🔍 PASSO 3: Simular callback OAuth');
    
    // Vamos testar o callback com parâmetros simulados
    const callbackUrl = `${baseUrl}/api/google/callback?error=access_denied`;
    console.log('URL de callback (erro simulado):', callbackUrl);
    
    const callbackResponse = await fetch(callbackUrl);
    console.log('Status do callback:', callbackResponse.status);
    
    if (callbackResponse.status === 302 || callbackResponse.status === 307) {
      const location = callbackResponse.headers.get('location');
      console.log('✅ Callback redirecionou para:', location);
      
      if (location && location.includes('error=oauth_error')) {
        console.log('✅ Tratamento de erro OAuth funcionando');
      }
    } else {
      const callbackText = await callbackResponse.text();
      console.log('⚠️ Resposta do callback:', callbackText.substring(0, 200));
    }
    
    console.log('\n🔍 PASSO 4: Verificar página de seleção de contas');
    
    const selectUrl = `${baseUrl}/google/select-accounts?connectionId=test&clientId=${clientId}`;
    console.log('URL de seleção:', selectUrl);
    
    const selectResponse = await fetch(selectUrl);
    console.log('Status da página de seleção:', selectResponse.status);
    
    if (selectResponse.ok) {
      console.log('✅ Página de seleção acessível');
    } else {
      const selectError = await selectResponse.text();
      console.log('❌ Erro na página de seleção:', selectError.substring(0, 200));
    }
    
    console.log('\n🔍 PASSO 5: Verificar dashboard Google');
    
    const dashboardUrl = `${baseUrl}/dashboard/google`;
    console.log('URL do dashboard:', dashboardUrl);
    
    const dashboardResponse = await fetch(dashboardUrl);
    console.log('Status do dashboard:', dashboardResponse.status);
    
    if (dashboardResponse.ok) {
      console.log('✅ Dashboard Google acessível');
    } else {
      const dashboardError = await dashboardResponse.text();
      console.log('❌ Erro no dashboard:', dashboardError.substring(0, 200));
    }
    
  } catch (error) {
    console.error('\n❌ ERRO NO DEBUG:', error.message);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🏁 DEBUG CONCLUÍDO');
  
  console.log('\n💡 POSSÍVEIS CAUSAS DO PROBLEMA:');
  console.log('1. OAuth não está sendo iniciado corretamente');
  console.log('2. Callback não está redirecionando para seleção de contas');
  console.log('3. Conexão não está sendo criada com customer_id: pending');
  console.log('4. Página de seleção não está carregando as contas');
  
  console.log('\n🔧 PRÓXIMOS PASSOS:');
  console.log('1. Verificar logs do callback OAuth no navegador');
  console.log('2. Confirmar se a conexão está sendo criada no banco');
  console.log('3. Testar o redirecionamento manualmente');
  console.log('4. Verificar se a API /api/google/accounts está funcionando');
}

// Executar debug
debugGoogleOAuthFlow().catch(console.error);