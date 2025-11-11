/**
 * Script para testar busca de páginas Meta no navegador
 * 
 * COMO USAR:
 * 1. Abra o navegador e vá para: http://localhost:3000/meta/select-accounts?access_token=SEU_TOKEN&client_id=SEU_CLIENT_ID
 * 2. Abra o Console do navegador (F12)
 * 3. Cole este script e execute
 */

async function testarPaginasMeta() {
  console.log('🔍 TESTE: Busca de Páginas Meta\n');
  
  // Pegar o token da URL
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('access_token');
  
  if (!accessToken) {
    console.error('❌ Access token não encontrado na URL');
    return;
  }
  
  console.log('✅ Access token encontrado');
  
  try {
    // Testar API local
    console.log('\n1️⃣ Testando API local /api/meta/accounts...');
    const localResponse = await fetch('/api/meta/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken })
    });
    
    const localData = await localResponse.json();
    console.log('📊 Resposta da API local:');
    console.log('   Contas de anúncios:', localData.adAccounts?.length || 0);
    console.log('   Páginas:', localData.pages?.length || 0);
    
    if (localData.pages?.length > 0) {
      console.log('\n📄 Páginas encontradas:');
      localData.pages.forEach((page, i) => {
        console.log(`   ${i + 1}. ${page.name} (${page.id})`);
      });
    } else {
      console.log('⚠️  Nenhuma página retornada pela API local');
    }
    
    // Testar API do Facebook diretamente
    console.log('\n2️⃣ Testando API do Facebook diretamente...');
    const fbResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}&fields=id,name,category,followers_count&limit=100`
    );
    
    const fbData = await fbResponse.json();
    console.log('📊 Resposta direta do Facebook:');
    console.log('   Páginas:', fbData.data?.length || 0);
    
    if (fbData.data?.length > 0) {
      console.log('\n📄 Páginas do Facebook:');
      fbData.data.forEach((page, i) => {
        console.log(`   ${i + 1}. ${page.name} (${page.id})`);
        console.log(`      Categoria: ${page.category}`);
      });
    } else {
      console.log('⚠️  Nenhuma página retornada pelo Facebook');
      
      if (fbData.error) {
        console.error('❌ Erro do Facebook:', fbData.error.message);
      }
    }
    
    // Verificar permissões
    console.log('\n3️⃣ Verificando permissões...');
    const permResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/permissions?access_token=${accessToken}`
    );
    
    const permData = await permResponse.json();
    const granted = permData.data?.filter(p => p.status === 'granted').map(p => p.permission) || [];
    
    console.log('🔐 Permissões concedidas:');
    granted.forEach(perm => console.log(`   ✓ ${perm}`));
    
    const hasPages = granted.includes('pages_show_list') || granted.includes('pages_read_engagement');
    console.log(`\n${hasPages ? '✅' : '❌'} Permissão de páginas: ${hasPages ? 'OK' : 'FALTANDO'}`);
    
    if (!hasPages) {
      console.log('\n⚠️  PROBLEMA IDENTIFICADO:');
      console.log('   O token não tem permissão para acessar páginas!');
      console.log('   Você precisa reconectar com as permissões corretas.');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
  
  console.log('\n✅ Teste concluído');
}

// Executar o teste
testarPaginasMeta();
