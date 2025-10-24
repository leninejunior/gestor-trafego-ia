#!/usr/bin/env node

/**
 * Script para verificar as chaves do Supabase
 */

require('dotenv').config();

console.log('\n🔍 Verificando configuração do Supabase...\n');

const checks = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    value: process.env.NEXT_PUBLIC_SUPABASE_URL,
    required: true,
    validate: (val) => val && val.startsWith('https://') && val.includes('.supabase.co')
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    required: true,
    validate: (val) => val && val.startsWith('eyJ') && val.length > 100
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    value: process.env.SUPABASE_SERVICE_ROLE_KEY,
    required: true,
    validate: (val) => val && val.startsWith('eyJ') && val.length > 100 && !val.includes('Ej8Ej8')
  }
];

let hasErrors = false;

checks.forEach(check => {
  const exists = !!check.value;
  const isValid = exists && check.validate(check.value);
  
  if (!exists) {
    console.log(`❌ ${check.name}: NÃO CONFIGURADA`);
    hasErrors = true;
  } else if (!isValid) {
    console.log(`⚠️  ${check.name}: INVÁLIDA`);
    console.log(`   Valor atual: ${check.value.substring(0, 50)}...`);
    hasErrors = true;
  } else {
    console.log(`✅ ${check.name}: OK`);
  }
});

console.log('\n');

if (hasErrors) {
  console.log('❌ PROBLEMAS ENCONTRADOS!\n');
  console.log('📋 Como corrigir:\n');
  console.log('1. Acesse: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/settings/api');
  console.log('2. Copie a "service_role" key (secret)');
  console.log('3. Cole no arquivo .env na variável SUPABASE_SERVICE_ROLE_KEY');
  console.log('4. Execute este script novamente para verificar\n');
  console.log('⚠️  ATENÇÃO: A service_role key é SECRETA e nunca deve ser exposta no frontend!\n');
  process.exit(1);
} else {
  console.log('✅ Todas as chaves do Supabase estão configuradas corretamente!\n');
  process.exit(0);
}
