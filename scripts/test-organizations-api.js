const https = require('https');
const http = require('http');

async function testOrganizationsAPI() {
  console.log('🔍 TESTANDO API DE ORGANIZAÇÕES...\n');
  
  try {
    const html = await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:3000/api/admin/subscription-management/organizations', {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ API respondeu - Status:', res.statusCode);
            resolve(data);
          } else {
            reject(new Error(`Status: ${res.statusCode} - ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Timeout')));
    });
    
    const result = JSON.parse(html);
    
    console.log('📊 Resposta da API:');
    console.log('Success:', result.success);
    console.log('Total organizações:', result.organizations?.length || 0);
    
    if (result.organizations && result.organizations.length > 0) {
      console.log('\n📋 Organizações encontradas:');
      result.organizations.forEach((org, i) => {
        console.log(`${i + 1}. ${org.name}`);
        if (org.subscription) {
          console.log(`   Plano: ${org.subscription.subscription_plans?.name || 'N/A'}`);
          console.log(`   Status: ${org.subscription.status}`);
          console.log(`   Preço: R$ ${org.subscription.subscription_plans?.monthly_price || 0}/mês`);
        } else {
          console.log('   ⚠️ Sem assinatura');
        }
        console.log('');
      });
    } else {
      console.log('⚠️ Nenhuma organização encontrada na API');
    }
    
  } catch (error) {
    console.log('❌ Erro ao testar API:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n📋 SERVIDOR NÃO ESTÁ RODANDO!');
      console.log('Execute: npm run dev');
    }
  }
}

testOrganizationsAPI().catch(console.error);