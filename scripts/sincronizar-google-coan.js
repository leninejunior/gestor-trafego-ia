/**
 * Script de Sincronização - Campanhas Google Ads do Cliente COAN
 * 
 * Força uma sincronização completa das campanhas
 */

const fetch = require('node-fetch');
require('dotenv').config();

async function sincronizar() {
  console.log('='.repeat(80));
  console.log('SINCRONIZAÇÃO: Campanhas Google Ads - Cliente COAN');
  console.log('='.repeat(80));
  console.log('');

  const clientId = 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751';
  const apiUrl = `http://localhost:3000/api/google/sync`;

  console.log('1️⃣ INICIANDO SINCRONIZAÇÃO...');
  console.log(`   Cliente ID: ${clientId}`);
  console.log(`   API URL: ${apiUrl}`);
  console.log('');

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: clientId,
        fullSync: true
      })
    });

    const data = await response.json();

    console.log('2️⃣ RESPOSTA DA API:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Dados:`, JSON.stringify(data, null, 2));
    console.log('');

    if (response.ok) {
      console.log('✅ SINCRONIZAÇÃO INICIADA COM SUCESSO!');
      console.log('');
      console.log('Aguarde alguns segundos e verifique:');
      console.log('   - Dashboard do Google Ads');
      console.log('   - Página de campanhas');
      console.log('');
    } else {
      console.log('❌ ERRO NA SINCRONIZAÇÃO');
      console.log('');
      console.log('Possíveis causas:');
      console.log('   - Token de acesso expirado');
      console.log('   - Credenciais do Google Ads inválidas');
      console.log('   - Problemas de conectividade');
      console.log('');
    }

  } catch (error) {
    console.error('❌ ERRO FATAL:', error.message);
    console.error('');
    console.error('Verifique se:');
    console.error('   - O servidor está rodando (npm run dev)');
    console.error('   - As variáveis de ambiente estão configuradas');
    console.error('');
  }

  console.log('='.repeat(80));
  console.log('SINCRONIZAÇÃO CONCLUÍDA');
  console.log('='.repeat(80));
}

sincronizar()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
