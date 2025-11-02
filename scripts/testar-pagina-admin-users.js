require('dotenv').config();

console.log('🧪 TESTANDO PÁGINA /admin/users');
console.log('===============================');

async function testarPaginaAdminUsers() {
  try {
    // Testar se a página carrega
    console.log('🌐 Testando carregamento da página...');
    
    const response = await fetch('http://localhost:3000/admin/users', {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log('📊 Status da resposta:', response.status);
    console.log('📋 Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const html = await response.text();
      console.log('✅ Página carregou com sucesso!');
      console.log('📄 Tamanho do HTML:', html.length, 'caracteres');
      
      // Verificar se contém elementos esperados
      const checks = [
        { name: 'Título "Gerenciar Usuários"', test: html.includes('Gerenciar Usuários') },
        { name: 'Componente de usuários', test: html.includes('user') || html.includes('User') },
        { name: 'Tabela', test: html.includes('table') || html.includes('Table') },
        { name: 'Cards de estatísticas', test: html.includes('Total') && html.includes('Ativos') }
      ];
      
      console.log('\n🔍 Verificações de conteúdo:');
      checks.forEach(check => {
        console.log(`${check.test ? '✅' : '❌'} ${check.name}`);
      });
      
      const passedChecks = checks.filter(c => c.test).length;
      console.log(`\n📊 Verificações: ${passedChecks}/${checks.length} passaram`);
      
    } else {
      console.log('❌ Página retornou erro:', response.status);
      
      if (response.status === 302 || response.status === 301) {
        const location = response.headers.get('location');
        console.log('🔄 Redirecionamento para:', location);
      }
      
      const text = await response.text();
      console.log('📄 Resposta:', text.substring(0, 500));
    }
    
    console.log('\n🎯 TESTE CONCLUÍDO!');
    
  } catch (error) {
    console.log('❌ Erro inesperado:', error.message);
  }
}

testarPaginaAdminUsers().catch(err => {
  console.log('❌ Erro na execução:', err.message);
});