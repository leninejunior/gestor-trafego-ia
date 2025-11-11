const { exec } = require('child_process');

console.log('🌐 Abrindo página de alertas de saldo...\n');
console.log('URL: http://localhost:3000/dashboard/balance-alerts');

// Abrir no navegador padrão
exec('start http://localhost:3000/dashboard/balance-alerts', (error) => {
  if (error) {
    console.error('Erro ao abrir navegador:', error);
    console.log('\n📋 Abra manualmente: http://localhost:3000/dashboard/balance-alerts');
  } else {
    console.log('✅ Navegador aberto!');
    console.log('\n📊 Você deve ver:');
    console.log('   - 2 contas conectadas');
    console.log('   - Saldos: R$ 47,78 e R$ 41,78');
    console.log('   - Status: CRÍTICO (ambas)');
    console.log('   - Botão "Criar Alerta" disponível');
  }
});
