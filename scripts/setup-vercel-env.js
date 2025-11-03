#!/usr/bin/env node

/**
 * Script para configurar variáveis de ambiente no Vercel
 * Execute: node scripts/setup-vercel-env.js
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 CONFIGURAÇÃO DE VARIÁVEIS DE AMBIENTE PARA VERCEL');
console.log('==================================================');

// Ler arquivo .env local
const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ Arquivo .env não encontrado!');
  console.log('Certifique-se de que o arquivo .env existe na raiz do projeto.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));

console.log('\n📋 VARIÁVEIS DE AMBIENTE ENCONTRADAS:');
console.log('=====================================');

const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
  'SUPABASE_SERVICE_ROLE_KEY',
  'META_APP_ID',
  'META_APP_SECRET',
  'NEXT_PUBLIC_APP_URL'
];

const optionalVars = [
  'META_ACCESS_TOKEN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_DEVELOPER_TOKEN',
  'GOOGLE_TOKEN_ENCRYPTION_KEY',
  'IUGU_API_TOKEN',
  'IUGU_ACCOUNT_ID',
  'NEXT_PUBLIC_IUGU_ACCOUNT_ID'
];

const foundVars = {};
const missingRequired = [];

// Parse variáveis
envLines.forEach(line => {
  const [key, ...valueParts] = line.split('=');
  const value = valueParts.join('=');
  if (key && value) {
    foundVars[key] = value;
  }
});

// Verificar variáveis obrigatórias
console.log('\n✅ VARIÁVEIS OBRIGATÓRIAS:');
requiredVars.forEach(varName => {
  if (foundVars[varName]) {
    const maskedValue = varName.includes('SECRET') || varName.includes('KEY') 
      ? foundVars[varName].substring(0, 10) + '...' 
      : foundVars[varName];
    console.log(`   ${varName}=${maskedValue}`);
  } else {
    console.log(`❌ ${varName}=FALTANDO`);
    missingRequired.push(varName);
  }
});

// Verificar variáveis opcionais
console.log('\n🔧 VARIÁVEIS OPCIONAIS:');
optionalVars.forEach(varName => {
  if (foundVars[varName]) {
    const maskedValue = varName.includes('SECRET') || varName.includes('KEY') || varName.includes('TOKEN')
      ? foundVars[varName].substring(0, 10) + '...' 
      : foundVars[varName];
    console.log(`   ${varName}=${maskedValue}`);
  } else {
    console.log(`⚠️  ${varName}=NÃO CONFIGURADA`);
  }
});

// Verificar problemas
if (missingRequired.length > 0) {
  console.log('\n❌ ERRO: Variáveis obrigatórias faltando!');
  console.log('Configure estas variáveis no arquivo .env:');
  missingRequired.forEach(varName => {
    console.log(`   ${varName}=`);
  });
  process.exit(1);
}

// Verificar URL localhost
if (foundVars['NEXT_PUBLIC_APP_URL'] && foundVars['NEXT_PUBLIC_APP_URL'].includes('localhost')) {
  console.log('\n⚠️  ATENÇÃO: NEXT_PUBLIC_APP_URL está configurada como localhost!');
  console.log('   Após o deploy no Vercel, atualize para a URL real.');
}

// Gerar comandos Vercel CLI
console.log('\n🔧 COMANDOS PARA VERCEL CLI:');
console.log('============================');
console.log('Execute estes comandos após instalar o Vercel CLI (npm i -g vercel):');
console.log('');

Object.entries(foundVars).forEach(([key, value]) => {
  if (requiredVars.includes(key) || optionalVars.includes(key)) {
    console.log(`vercel env add ${key} production`);
  }
});

console.log('\n📝 INSTRUÇÕES PARA VERCEL DASHBOARD:');
console.log('====================================');
console.log('1. Acesse https://vercel.com/dashboard');
console.log('2. Selecione seu projeto');
console.log('3. Vá em Settings > Environment Variables');
console.log('4. Adicione cada variável manualmente:');
console.log('');

Object.entries(foundVars).forEach(([key, value]) => {
  if (requiredVars.includes(key) || optionalVars.includes(key)) {
    const displayValue = key.includes('SECRET') || key.includes('KEY') || key.includes('TOKEN')
      ? '[VALOR_SENSÍVEL]'
      : value;
    console.log(`   ${key} = ${displayValue}`);
  }
});

console.log('\n🚨 IMPORTANTE APÓS O DEPLOY:');
console.log('============================');
console.log('1. Anote a URL do Vercel (ex: https://seu-projeto.vercel.app)');
console.log('2. Atualize NEXT_PUBLIC_APP_URL com a URL real');
console.log('3. Configure callbacks OAuth:');
console.log('   - Meta: https://seu-projeto.vercel.app/api/meta/callback');
console.log('   - Google: https://seu-projeto.vercel.app/api/google/callback');
console.log('4. Redeploy o projeto após atualizar as variáveis');

console.log('\n✅ Configuração verificada com sucesso!');
console.log('Agora você pode fazer o deploy no Vercel.');