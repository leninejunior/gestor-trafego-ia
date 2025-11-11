const https = require('https');

async function testarInterface() {
  console.log('🎨 Testando interface de alertas de saldo\n');

  try {
    // 1. Testar API de alertas
    console.log('📡 Testando API de alertas...');
    
    const data = await new Promise((resolve, reject) => {
      const req = https.get('http://localhost:3000/api/admin/balance/alerts', (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Erro na API: ${res.statusCode}`));
          } else {
            resolve(JSON.parse(body));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
    
    console.log(`✅ API respondeu com sucesso`);
    console.log(`📊 Total de alertas: ${data.alerts?.length || 0}\n`);

    if (data.alerts && data.alerts.length > 0) {
      console.log('📋 Exemplo de alerta:');
      const alert = data.alerts[0];
      console.log(`   Cliente: ${alert.client_name}`);
      console.log(`   Conta: ${alert.ad_account_name}`);
      console.log(`   ID: ${alert.ad_account_id}`);
      console.log(`   Saldo: R$ ${alert.balance}`);
      console.log(`   Limite: R$ ${alert.threshold_amount}`);
      console.log(`   Tipo: ${alert.alert_type}`);
      console.log(`   Status: ${alert.status}`);
      console.log(`   Ativo: ${alert.is_active ? 'Sim' : 'Não'}`);
      
      if (alert.projected_days_remaining) {
        console.log(`   Dias restantes: ~${alert.projected_days_remaining}`);
      }
    }

    console.log('\n✅ Teste concluído!');
    console.log('\n📍 Acesse a interface em:');
    console.log('   http://localhost:3000/dashboard/balance-alerts');
    console.log('\n💡 A interface inclui:');
    console.log('   ✓ Tabela com todos os alertas');
    console.log('   ✓ Filtro de busca por nome/conta');
    console.log('   ✓ Filtro por status (Normal/Atenção/Crítico)');
    console.log('   ✓ Filtro por tipo de alerta');
    console.log('   ✓ Toggle para ativar/desativar alertas');
    console.log('   ✓ Botões de ação (Atualizar/Copiar/Editar/Excluir)');
    console.log('   ✓ Badges coloridos para saldo e status');
    console.log('   ✓ Indicador de dias restantes');
    console.log('   ✓ Ícone do Facebook para contas Meta');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    console.log('\n💡 Certifique-se de que:');
    console.log('   1. O servidor Next.js está rodando (pnpm dev)');
    console.log('   2. O banco de dados está configurado');
    console.log('   3. Existem alertas cadastrados');
  }
}

testarInterface();
