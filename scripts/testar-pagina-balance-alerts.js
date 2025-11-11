/**
 * Abre a página de alertas de saldo no navegador
 */

const { exec } = require('child_process');

const url = 'http://localhost:3000/dashboard/balance-alerts';

console.log('🌐 Abrindo página de alertas de saldo...');
console.log('📍 URL:', url);
console.log('\n✅ Verifique se:');
console.log('   1. As contas estão sendo exibidas');
console.log('   2. Os saldos estão corretos');
console.log('   3. Os status (critical/warning/healthy) estão visíveis');
console.log('   4. É possível configurar alertas');
console.log('\n💡 Abra o DevTools (F12) e veja o Console para logs');

// Abrir no navegador padrão
const command = process.platform === 'win32' 
  ? `start ${url}` 
  : process.platform === 'darwin' 
    ? `open ${url}` 
    : `xdg-open ${url}`;

exec(command, (error) => {
  if (error) {
    console.error('\n❌ Erro ao abrir navegador:', error.message);
    console.log('\n💡 Abra manualmente:', url);
  } else {
    console.log('\n✅ Navegador aberto!');
  }
});
