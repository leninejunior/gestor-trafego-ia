// Script para executar no console do navegador
// Abra o DevTools (F12) e cole este código no console

console.log('🔍 DEBUG FRONTEND - EXCLUSÃO DE CLIENTES');
console.log('=========================================');

// 1. Verificar se há clientes na página
const clientElements = document.querySelectorAll('[data-client-id]');
console.log(`📊 Elementos de cliente encontrados: ${clientElements.length}`);

// 2. Verificar IDs dos clientes visíveis
clientElements.forEach((element, index) => {
  const clientId = element.getAttribute('data-client-id');
  console.log(`Cliente ${index + 1}: ${clientId}`);
});

// 3. Interceptar requisições fetch
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('🌐 Fetch interceptado:', args[0]);
  if (args[0].includes('/api/clients')) {
    console.log('📡 Requisição para API de clientes:', args);
  }
  return originalFetch.apply(this, args);
};

// 4. Verificar localStorage e sessionStorage
console.log('💾 LocalStorage:', Object.keys(localStorage));
console.log('💾 SessionStorage:', Object.keys(sessionStorage));

// 5. Verificar cookies
console.log('🍪 Cookies:', document.cookie);

// 6. Testar chamada direta à API
async function testarAPIClientes() {
  try {
    console.log('🧪 Testando API de clientes...');
    const response = await fetch('/api/clients', {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Resposta da API:', data);
      
      if (data.clients && data.clients.length > 0) {
        console.log('📋 IDs dos clientes da API:');
        data.clients.forEach((client, index) => {
          console.log(`  ${index + 1}. ${client.id} - ${client.name}`);
        });
      }
    } else {
      console.log('❌ Erro na API:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ Erro ao testar API:', error);
  }
}

testarAPIClientes();

console.log('✅ Debug configurado. Agora tente excluir um cliente e observe os logs.');