const { exec } = require('child_process');

console.log('🌐 Abrindo página de alertas de saldo no navegador...\n');

const url = 'http://localhost:3000/dashboard/balance-alerts';

// Abrir no navegador padrão do Windows
exec(`start ${url}`, (error) => {
  if (error) {
    console.error('❌ Erro ao abrir navegador:', error);
    return;
  }
  
  console.log('✅ Navegador aberto!');
  console.log(`📍 URL: ${url}`);
  console.log('\n📋 Verifique:');
  console.log('   1. Se a página carrega sem erros');
  console.log('   2. Se os alertas aparecem na tabela');
  console.log('   3. Se os botões funcionam');
  console.log('   4. Console do navegador (F12) para erros');
});
