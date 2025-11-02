require('dotenv').config();

async function testarAPIAuth() {
  console.log('🌐 Testando API de autenticação...');
  
  const baseUrl = 'http://localhost:3000';
  
  try {
    // Testar se a página de login carrega
    console.log('📄 Testando página de login...');
    const loginResponse = await fetch(`${baseUrl}/login`);
    console.log(`Status da página de login: ${loginResponse.status}`);
    
    if (loginResponse.ok) {
      console.log('✅ Página de login carregou com sucesso');
    } else {
      console.log('❌ Erro ao carregar página de login');
    }
    
    // Testar se a página principal carrega
    console.log('\n🏠 Testando página principal...');
    const homeResponse = await fetch(`${baseUrl}/`);
    console.log(`Status da página principal: ${homeResponse.status}`);
    
    if (homeResponse.ok) {
      console.log('✅ Página principal carregou com sucesso');
    } else {
      console.log('❌ Erro ao carregar página principal');
    }
    
    // Testar se o dashboard redireciona para login (sem autenticação)
    console.log('\n🏢 Testando redirecionamento do dashboard...');
    const dashboardResponse = await fetch(`${baseUrl}/dashboard`, {
      redirect: 'manual'
    });
    console.log(`Status do dashboard: ${dashboardResponse.status}`);
    
    if (dashboardResponse.status === 302 || dashboardResponse.status === 307) {
      const location = dashboardResponse.headers.get('location');
      console.log(`✅ Dashboard redirecionou para: ${location}`);
    } else {
      console.log('❌ Dashboard não redirecionou como esperado');
    }
    
  } catch (error) {
    console.log('❌ Erro ao testar APIs:', error.message);
  }
}

testarAPIAuth().then(() => {
  console.log('\n✅ Teste de API concluído');
}).catch(err => {
  console.log('❌ Erro no teste:', err.message);
});