// Cole este código no console do navegador (F12)
// quando estiver na página /dashboard/clients

console.log('🔍 DEBUG SIMPLES - CLIENTES');
console.log('===========================');

// 1. Interceptar todas as requisições
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  const options = args[1] || {};
  
  if (url.includes('/api/clients')) {
    console.log('🎯 REQUISIÇÃO PARA API DE CLIENTES:');
    console.log('URL:', url);
    console.log('Método:', options.method || 'GET');
    
    if (options.method === 'DELETE') {
      console.log('🗑️ TENTATIVA DE EXCLUSÃO!');
      console.log('URL completa:', url);
      
      // Extrair o ID da URL
      const urlObj = new URL(url, window.location.origin);
      const clientId = urlObj.searchParams.get('id');
      console.log('ID extraído da URL:', clientId);
      console.log('Tamanho do ID:', clientId?.length);
      console.log('Começa com eyJ:', clientId?.startsWith('eyJ'));
    }
  }
  
  return originalFetch.apply(this, args);
};

// 2. Verificar dados na página atual
setTimeout(() => {
  console.log('📊 VERIFICANDO DADOS NA PÁGINA...');
  
  // Procurar por links de clientes
  const clientLinks = document.querySelectorAll('a[href*="/dashboard/clients/"]');
  console.log(`🔗 Links de clientes encontrados: ${clientLinks.length}`);
  
  clientLinks.forEach((link, index) => {
    const href = link.getAttribute('href');
    const clientId = href.split('/').pop();
    console.log(`Cliente ${index + 1}: ${clientId}`);
    console.log(`  Tamanho: ${clientId.length}`);
    console.log(`  Começa com eyJ: ${clientId.startsWith('eyJ')}`);
  });
  
  // Procurar por elementos com data attributes
  const elementsWithData = document.querySelectorAll('[data-client-id]');
  console.log(`📋 Elementos com data-client-id: ${elementsWithData.length}`);
  
  elementsWithData.forEach((element, index) => {
    const clientId = element.getAttribute('data-client-id');
    console.log(`Data ${index + 1}: ${clientId}`);
  });
  
}, 1000);

console.log('✅ Debug configurado! Agora tente excluir um cliente.');
console.log('📝 Observe os logs acima para ver os IDs sendo usados.');