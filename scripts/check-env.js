// Script para verificar se as variáveis de ambiente estão configuradas
const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuração das variáveis de ambiente...\n');

// Ler arquivo .env
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.log('❌ Arquivo .env não encontrado!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

// Variáveis obrigatórias
const requiredVars = {
  'NEXT_PUBLIC_SUPABASE_URL': 'Supabase URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'Supabase Anon Key',
  'META_APP_ID': 'Meta App ID',
  'META_APP_SECRET': 'Meta App Secret',
  'META_ACCESS_TOKEN': 'Meta Access Token',
  'NEXT_PUBLIC_APP_URL': 'App URL'
};

const optionalVars = {
  'GOOGLE_CLIENT_ID': 'Google Client ID',
  'GOOGLE_CLIENT_SECRET': 'Google Client Secret'
};

let allConfigured = true;
let metaConfigured = true;

console.log('📋 Variáveis Obrigatórias:');
console.log('========================');

Object.entries(requiredVars).forEach(([key, description]) => {
  const line = lines.find(l => l.startsWith(key + '='));
  if (line) {
    const value = line.split('=')[1]?.replace(/"/g, '').trim();
    if (value && !value.startsWith('your_')) {
      console.log(`✅ ${description}: Configurado`);
    } else {
      console.log(`❌ ${description}: NÃO CONFIGURADO`);
      allConfigured = false;
      if (key.startsWith('META_')) {
        metaConfigured = false;
      }
    }
  } else {
    console.log(`❌ ${description}: NÃO ENCONTRADO`);
    allConfigured = false;
    if (key.startsWith('META_')) {
      metaConfigured = false;
    }
  }
});

console.log('\n📋 Variáveis Opcionais:');
console.log('======================');

Object.entries(optionalVars).forEach(([key, description]) => {
  const line = lines.find(l => l.startsWith(key + '='));
  if (line) {
    const value = line.split('=')[1]?.replace(/"/g, '').trim();
    if (value && !value.startsWith('your_')) {
      console.log(`✅ ${description}: Configurado`);
    } else {
      console.log(`⚠️  ${description}: Não configurado (opcional)`);
    }
  } else {
    console.log(`⚠️  ${description}: Não encontrado (opcional)`);
  }
});

console.log('\n📊 Resumo:');
console.log('==========');

if (allConfigured) {
  console.log('🎉 Todas as variáveis obrigatórias estão configuradas!');
  console.log('✅ Sistema pronto para uso');
} else {
  console.log('❌ Algumas variáveis obrigatórias não estão configuradas');
  
  if (!metaConfigured) {
    console.log('\n🔵 Para configurar Meta Ads:');
    console.log('1. Acesse: https://developers.facebook.com/');
    console.log('2. Crie um novo app');
    console.log('3. Configure as variáveis META_* no arquivo .env');
    console.log('4. Veja o guia completo em: docs/SETUP_META_ADS.md');
  }
}

console.log('\n🔗 Links úteis:');
console.log('- Supabase: https://supabase.com');
console.log('- Meta for Developers: https://developers.facebook.com/');
console.log('- Guia Meta Ads: docs/SETUP_META_ADS.md');

if (!allConfigured) {
  process.exit(1);
}