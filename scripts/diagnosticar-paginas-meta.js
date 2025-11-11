const axios = require('axios');

async function diagnosticarPaginasMeta() {
  console.log('🔍 DIAGNÓSTICO: Busca de Páginas Meta\n');
  console.log('=' .repeat(60));

  // Pegar o token do .env
  require('dotenv').config();
  
  // Você precisa fornecer um access token válido aqui
  const accessToken = process.env.META_ACCESS_TOKEN || 'COLE_SEU_TOKEN_AQUI';
  
  if (accessToken === 'COLE_SEU_TOKEN_AQUI') {
    console.log('❌ Por favor, defina META_ACCESS_TOKEN no .env ou cole um token válido no script');
    return;
  }

  try {
    console.log('\n1️⃣ Testando busca de contas de anúncios...');
    const adAccountsResponse = await axios.get('https://graph.facebook.com/v21.0/me/adaccounts', {
      params: {
        access_token: accessToken,
        fields: 'id,name,account_status',
        limit: 5
      }
    });
    
    console.log(`✅ Contas de anúncios: ${adAccountsResponse.data.data?.length || 0} encontradas`);
    if (adAccountsResponse.data.data?.length > 0) {
      console.log('   Primeira conta:', adAccountsResponse.data.data[0].name);
    }

    console.log('\n2️⃣ Testando busca de páginas (me/accounts)...');
    const pagesResponse = await axios.get('https://graph.facebook.com/v21.0/me/accounts', {
      params: {
        access_token: accessToken,
        fields: 'id,name,category,followers_count',
        limit: 100
      }
    });
    
    console.log(`✅ Páginas encontradas: ${pagesResponse.data.data?.length || 0}`);
    
    if (pagesResponse.data.data?.length > 0) {
      console.log('\n📄 Páginas encontradas:');
      pagesResponse.data.data.forEach((page, index) => {
        console.log(`   ${index + 1}. ${page.name} (ID: ${page.id})`);
        console.log(`      Categoria: ${page.category}`);
        if (page.followers_count) {
          console.log(`      Seguidores: ${page.followers_count}`);
        }
      });
    } else {
      console.log('⚠️  Nenhuma página encontrada!');
      console.log('\n🔍 Possíveis causas:');
      console.log('   1. O token não tem permissão "pages_show_list"');
      console.log('   2. O usuário não é admin de nenhuma página');
      console.log('   3. As páginas não foram autorizadas no OAuth');
    }

    console.log('\n3️⃣ Verificando permissões do token...');
    const permissionsResponse = await axios.get('https://graph.facebook.com/v21.0/me/permissions', {
      params: {
        access_token: accessToken
      }
    });
    
    console.log('\n🔐 Permissões concedidas:');
    const grantedPermissions = permissionsResponse.data.data
      .filter(p => p.status === 'granted')
      .map(p => p.permission);
    
    grantedPermissions.forEach(perm => {
      console.log(`   ✓ ${perm}`);
    });

    // Verificar permissões importantes
    const requiredPermissions = [
      'ads_management',
      'ads_read',
      'pages_show_list',
      'pages_read_engagement',
      'business_management'
    ];

    console.log('\n📋 Verificação de permissões necessárias:');
    requiredPermissions.forEach(perm => {
      const hasPermission = grantedPermissions.includes(perm);
      console.log(`   ${hasPermission ? '✅' : '❌'} ${perm}`);
    });

    console.log('\n4️⃣ Testando busca de páginas do Business Manager...');
    try {
      const businessPagesResponse = await axios.get('https://graph.facebook.com/v21.0/me', {
        params: {
          access_token: accessToken,
          fields: 'businesses{owned_pages{id,name,category}}'
        }
      });
      
      if (businessPagesResponse.data.businesses?.data?.length > 0) {
        console.log('✅ Páginas do Business Manager encontradas:');
        businessPagesResponse.data.businesses.data.forEach(business => {
          if (business.owned_pages?.data?.length > 0) {
            business.owned_pages.data.forEach(page => {
              console.log(`   - ${page.name} (ID: ${page.id})`);
            });
          }
        });
      } else {
        console.log('⚠️  Nenhuma página no Business Manager');
      }
    } catch (error) {
      console.log('⚠️  Não foi possível buscar páginas do Business Manager');
      console.log('   Isso pode ser normal se não houver permissão business_management');
    }

  } catch (error) {
    console.error('\n❌ Erro durante o diagnóstico:', error.response?.data || error.message);
    
    if (error.response?.data?.error) {
      console.log('\n📝 Detalhes do erro:');
      console.log('   Código:', error.response.data.error.code);
      console.log('   Mensagem:', error.response.data.error.message);
      console.log('   Tipo:', error.response.data.error.type);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Diagnóstico concluído\n');
}

diagnosticarPaginasMeta();
