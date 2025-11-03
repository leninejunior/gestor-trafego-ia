#!/usr/bin/env node

/**
 * Debug Google Auth no localhost
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 DEBUG GOOGLE AUTH LOCALHOST');
console.log('==============================');

// Ler .env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

console.log('\n📋 VARIÁVEIS GOOGLE ENCONTRADAS:');
console.log('================================');

const googleVars = envContent
  .split('\n')
  .filter(line => line.includes('GOOGLE_') || line.includes('NEXT_PUBLIC_APP_URL'))
  .filter(line => !line.startsWith('#'));

googleVars.forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    console.log(`${key}: ${value.substring(0, 20)}...`);
  }
});

console.log('\n🔍 VERIFICAÇÕES:');
console.log('================');

const requiredVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET', 
  'GOOGLE_DEVELOPER_TOKEN',
  'NEXT_PUBLIC_APP_URL'
];

requiredVars.forEach(varName => {
  const line = googleVars.find(l => l.startsWith(varName + '='));
  if (line) {
    const value = line.split('=')[1];
    const hasValue = value && value.trim() !== '';
    const isPlaceholder = value && (value.includes('your_') || value.includes('localhost'));
    
    console.log(`${varName}: ${hasValue ? '✅' : '❌'} ${isPlaceholder ? '⚠️ PLACEHOLDER' : 'OK'}`);
  } else {
    console.log(`${varName}: ❌ NÃO ENCONTRADA`);
  }
});

console.log('\n🎯 PROBLEMA IDENTIFICADO:');
console.log('=========================');

const appUrlLine = googleVars.find(l => l.startsWith('NEXT_PUBLIC_APP_URL='));
if (appUrlLine) {
  const appUrl = appUrlLine.split('=')[1];
  if (appUrl.includes('localhost')) {
    console.log('⚠️ NEXT_PUBLIC_APP_URL está como localhost');
    console.log('📝 Isso pode estar causando o erro 503');
    console.log('💡 Para desenvolvimento local, isso é normal');
    console.log('🔧 O problema é na validação da API, não nas variáveis');
  }
}

console.log('\n🛠️ SOLUÇÃO:');
console.log('============');
console.log('1. Remover validação de localhost da API');
console.log('2. Permitir localhost em desenvolvimento');
console.log('3. Manter validação apenas para produção');

console.log('\n✅ Debug concluído!');