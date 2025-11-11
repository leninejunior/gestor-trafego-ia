const http = require('http');

const BASE_URL = 'http://localhost:3000';

async function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    const req = http.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function testarInterface() {
  console.log('🧪 TESTANDO INTERFACE DE ALERTAS DE SALDO\n');
  console.log('='.repeat(60));

  // 1. Testar API de contas
  console.log('\n📋 1. Testando API de Contas (/api/admin/balance/accounts)');
  console.log('-'.repeat(60));
  
  try {
    const accountsResponse = await makeRequest('/api/admin/balance/accounts', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`Status: ${accountsResponse.status}`);
    
    if (accountsResponse.status === 200) {
      const accounts = accountsResponse.data.accounts || [];
      console.log(`✅ ${accounts.length} conta(s) encontrada(s)`);
      
      if (accounts.length > 0) {
        console.log('\n📊 Primeiras 3 contas:');
        accounts.slice(0, 3).forEach((account, index) => {
          console.log(`\n  ${index + 1}. ${account.client_name}`);
          console.log(`     Conta: ${account.ad_account_name}`);
          console.log(`     ID: ${account.ad_account_id}`);
          console.log(`     Saldo: R$ ${account.balance.toFixed(2)}`);
          console.log(`     Tem Alerta: ${account.has_alert ? 'Sim' : 'Não'}`);
        });
      }
    } else {
      console.log(`❌ Erro: ${JSON.stringify(accountsResponse.data)}`);
    }
  } catch (error) {
    console.log(`❌ Erro na requisição: ${error.message}`);
  }

  // 2. Testar API de alertas
  console.log('\n\n📋 2. Testando API de Alertas (/api/admin/balance/alerts)');
  console.log('-'.repeat(60));
  
  try {
    const alertsResponse = await makeRequest('/api/admin/balance/alerts', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`Status: ${alertsResponse.status}`);
    
    if (alertsResponse.status === 200) {
      const alerts = alertsResponse.data.alerts || [];
      console.log(`✅ ${alerts.length} alerta(s) configurado(s)`);
      
      if (alerts.length > 0) {
        console.log('\n📊 Primeiros 3 alertas:');
        alerts.slice(0, 3).forEach((alert, index) => {
          console.log(`\n  ${index + 1}. ${alert.client_name}`);
          console.log(`     Conta: ${alert.ad_account_name}`);
          console.log(`     Saldo: R$ ${alert.balance.toFixed(2)}`);
          console.log(`     Limite: R$ ${alert.threshold_amount.toFixed(2)}`);
          console.log(`     Status: ${alert.status}`);
          console.log(`     Ativo: ${alert.is_active ? 'Sim' : 'Não'}`);
        });
      }
    } else {
      console.log(`❌ Erro: ${JSON.stringify(alertsResponse.data)}`);
    }
  } catch (error) {
    console.log(`❌ Erro na requisição: ${error.message}`);
  }

  // 3. Resumo
  console.log('\n\n📊 RESUMO');
  console.log('='.repeat(60));
  console.log('✅ Interface atualizada com 2 abas:');
  console.log('   1. Contas Conectadas - Lista todas as contas Meta Ads');
  console.log('   2. Alertas Configurados - Gerencia os alertas ativos');
  console.log('\n💡 Acesse: http://localhost:3000/dashboard/balance-alerts');
  console.log('\n✨ Agora você pode ver todas as contas e criar alertas!');
}

testarInterface().catch(console.error);
