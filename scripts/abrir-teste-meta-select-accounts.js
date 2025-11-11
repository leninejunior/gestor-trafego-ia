/**
 * Abre a página de seleção de contas Meta no navegador
 */

const { exec } = require('child_process');

const url = 'http://localhost:3000/meta/select-accounts?access_token=test_token&client_id=e3ab33da-79f9-45e9-a43f-6ce76ceb9751';

console.log('🌐 Abrindo navegador...');
console.log('URL:', url);

exec(`start ${url}`, (error) => {
  if (error) {
    console.error('Erro ao abrir navegador:', error);
  } else {
    console.log('✅ Navegador aberto!');
  }
});
