#!/usr/bin/env node

/**
 * Script para corrigir Google Auth 503 em produção
 */

console.log('🔧 CORRIGINDO GOOGLE AUTH 503 EM PRODUÇÃO');
console.log('==========================================');

console.log('\n🎯 PROBLEMA IDENTIFICADO:');
console.log('=========================');
console.log('✅ Dev funciona - vai para Google OAuth');
console.log('❌ Produção falha - erro 503');
console.log('🔍 Causa: Variáveis não configuradas no Vercel');

console.log('\n📋 VARIÁVEIS NECESSÁRIAS NO VERCEL:');
console.log('===================================');

const requiredVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET', 
  'GOOGLE_DEVELOPER_TOKEN',
  'GOOGLE_TOKEN_ENCRYPTION_KEY',
  'NEXT_PUBLIC_APP_URL'
];

requiredVars.forEach((varName, index) => {
  console.log(`${index + 1}. ${varName}`);
});

console.log('\n🚀 SOLUÇÃO IMEDIATA:');
console.log('====================');
console.log('1. Acesse: https://vercel.com/dashboard');
console.log('2. Vá para seu projeto');
console.log('3. Settings > Environment Variables');
console.log('4. Adicione as variáveis Google do .env local');

console.log('\n📝 COMANDOS PARA COPIAR VARIÁVEIS:');
console.log('==================================');

const fs = require('fs');
const path = require('path');

// Ler .env local
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const googleVars = envContent
  .split('\n')
  .filter(line => line.includes('GOOGLE_') || line.includes('NEXT_PUBLIC_APP_URL'))
  .filter(line => !line.startsWith('#') && line.includes('='));

console.log('\n🔑 VALORES PARA ADICIONAR NO VERCEL:');
console.log('===================================');

googleVars.forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    // Para produção, ajustar NEXT_PUBLIC_APP_URL
    if (key === 'NEXT_PUBLIC_APP_URL') {
      console.log(`${key}=https://gestor.engrene.com`);
    } else {
      console.log(`${key}=${value}`);
    }
  }
});

console.log('\n⚠️ IMPORTANTE:');
console.log('==============');
console.log('- NEXT_PUBLIC_APP_URL deve ser https://gestor.engrene.com');
console.log('- Outras variáveis copie exatamente do .env local');
console.log('- Após adicionar, faça redeploy do projeto');

console.log('\n🔄 APÓS CONFIGURAR:');
console.log('==================');
console.log('1. Redeploy no Vercel');
console.log('2. Teste Google Auth em produção');
console.log('3. Deve redirecionar para Google OAuth');

console.log('\n✅ Script concluído!');