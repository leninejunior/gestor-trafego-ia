#!/usr/bin/env node

/**
 * Script para testar variáveis Google em produção
 */

const https = require('https');

console.log('🔍 TESTANDO VARIÁVEIS GOOGLE EM PRODUÇÃO');
console.log('========================================');

const productionUrl = 'https://gestor.engrene.com/api/google/auth?clientId=test-123';

console.log('\n📡 Fazendo requisição para produção...');
console.log('URL:', productionUrl);

const options = {
  hostname: 'gestor.engrene.com',
  port: 443,
  path: '/api/google/auth?clientId=e0ae65bf-1f97-474a-988e-a5418ab28e77',
  method: 'GET',
  headers: {
    'User-Agent': 'Test-Script/1.0'
  }
};

const req = https.request(options, (res) => {
  console.log('\n📊 RESPOSTA DA PRODUÇÃO:');
  console.log('========================');
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n📄 CORPO DA RESPOSTA:');
    console.log('=====================');
    
    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
      
      if (res.statusCode === 503) {
        console.log('\n❌ ERRO 503 CONFIRMADO');
        console.log('======================');
        
        if (jsonData.error === 'Google Ads não configurado') {
          console.log('🔍 Causa: Variáveis Google não configuradas no Vercel');
          console.log('💡 Solução: Adicionar variáveis no Vercel Dashboard');
          
          if (jsonData.details) {
            console.log('\n📋 DETALHES DO ERRO:');
            console.log('Missing:', jsonData.details.missing || 'Nenhuma');
            console.log('Invalid:', jsonData.details.invalid || 'Nenhuma');
          }
        }
      } else if (res.statusCode === 200) {
        console.log('\n✅ SUCESSO!');
        console.log('===========');
        console.log('Google Auth configurado corretamente em produção');
        
        if (jsonData.authUrl) {
          console.log('OAuth URL gerada:', jsonData.authUrl.substring(0, 50) + '...');
        }
      }
      
    } catch (e) {
      console.log('Resposta não é JSON válido:');
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error('\n❌ ERRO NA REQUISIÇÃO:');
  console.error('======================');
  console.error(e.message);
});

req.setTimeout(10000, () => {
  console.log('\n⏰ TIMEOUT');
  console.log('==========');
  console.log('Requisição demorou mais de 10 segundos');
  req.destroy();
});

req.end();

console.log('\n⏳ Aguardando resposta...');