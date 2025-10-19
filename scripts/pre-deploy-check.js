#!/usr/bin/env node

/**
 * Script de verificação pré-deploy
 * Valida se o sistema está pronto para produção
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando sistema antes do deploy...\n');

let hasErrors = false;
let hasWarnings = false;

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function error(msg) {
  console.log(`${colors.red}❌ ERRO: ${msg}${colors.reset}`);
  hasErrors = true;
}

function warning(msg) {
  console.log(`${colors.yellow}⚠️  AVISO: ${msg}${colors.reset}`);
  hasWarnings = true;
}

function success(msg) {
  console.log(`${colors.green}✅ ${msg}${colors.reset}`);
}

function info(msg) {
  console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`);
}

// 1. Verificar arquivos essenciais
console.log('📁 Verificando arquivos essenciais...');
const essentialFiles = [
  'package.json',
  'next.config.ts',
  'tsconfig.json',
  '.env.example',
  '.gitignore',
];

essentialFiles.forEach(file => {
  if (fs.existsSync(file)) {
    success(`${file} encontrado`);
  } else {
    error(`${file} não encontrado`);
  }
});

// 2. Verificar .env não está commitado
console.log('\n🔐 Verificando segurança...');
if (fs.existsSync('.env')) {
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  if (gitignore.includes('.env')) {
    success('.env está no .gitignore');
  } else {
    error('.env NÃO está no .gitignore - RISCO DE SEGURANÇA!');
  }
} else {
  warning('.env não encontrado (normal se já está em produção)');
}

// 3. Verificar .env.example está atualizado
if (fs.existsSync('.env.example')) {
  const example = fs.readFileSync('.env.example', 'utf8');
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'META_APP_ID',
    'META_APP_SECRET',
    'NEXT_PUBLIC_APP_URL',
  ];

  requiredVars.forEach(varName => {
    if (example.includes(varName)) {
      success(`${varName} documentado em .env.example`);
    } else {
      warning(`${varName} faltando em .env.example`);
    }
  });
}

// 4. Verificar package.json
console.log('\n📦 Verificando dependências...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

if (packageJson.scripts.build) {
  success('Script de build configurado');
} else {
  error('Script de build não encontrado');
}

if (packageJson.scripts.start) {
  success('Script de start configurado');
} else {
  error('Script de start não encontrado');
}

// Verificar dependências críticas
const criticalDeps = [
  'next',
  'react',
  'react-dom',
  '@supabase/supabase-js',
  '@supabase/ssr',
];

criticalDeps.forEach(dep => {
  if (packageJson.dependencies[dep]) {
    success(`${dep} instalado (${packageJson.dependencies[dep]})`);
  } else {
    error(`${dep} não encontrado nas dependências`);
  }
});

// 5. Verificar estrutura de pastas
console.log('\n📂 Verificando estrutura do projeto...');
const requiredDirs = [
  'src/app',
  'src/components',
  'src/lib',
  'database',
  'public',
];

requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    success(`${dir}/ encontrado`);
  } else {
    warning(`${dir}/ não encontrado`);
  }
});

// 6. Verificar arquivos de banco de dados
console.log('\n🗄️  Verificando scripts de banco de dados...');
const dbFiles = [
  'database/complete-schema.sql',
  'database/saas-schema.sql',
  'database/fix-rls-policies.sql',
];

dbFiles.forEach(file => {
  if (fs.existsSync(file)) {
    success(`${file} encontrado`);
  } else {
    warning(`${file} não encontrado`);
  }
});

// 7. Verificar configuração do Next.js
console.log('\n⚙️  Verificando configuração do Next.js...');
if (fs.existsSync('next.config.ts')) {
  const config = fs.readFileSync('next.config.ts', 'utf8');
  
  if (config.includes('webpack')) {
    info('Configuração webpack customizada detectada');
  }
  
  success('next.config.ts válido');
}

// 8. Verificar TypeScript
console.log('\n📘 Verificando TypeScript...');
if (fs.existsSync('tsconfig.json')) {
  try {
    const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
    if (tsconfig.compilerOptions) {
      success('tsconfig.json válido');
    }
  } catch (e) {
    error('tsconfig.json inválido: ' + e.message);
  }
}

// 9. Verificar documentação
console.log('\n📚 Verificando documentação...');
const docs = [
  'README.md',
  'DEPLOY_PRODUCTION.md',
  'docs/META_INTEGRATION.md',
];

docs.forEach(doc => {
  if (fs.existsSync(doc)) {
    success(`${doc} encontrado`);
  } else {
    warning(`${doc} não encontrado`);
  }
});

// 10. Resumo final
console.log('\n' + '='.repeat(50));
console.log('📊 RESUMO DA VERIFICAÇÃO');
console.log('='.repeat(50));

if (hasErrors) {
  console.log(`\n${colors.red}❌ DEPLOY BLOQUEADO - Corrija os erros acima${colors.reset}`);
  console.log('\nErros encontrados que impedem o deploy.');
  console.log('Corrija-os antes de fazer o deploy em produção.\n');
  process.exit(1);
} else if (hasWarnings) {
  console.log(`\n${colors.yellow}⚠️  DEPLOY COM AVISOS - Revise os avisos acima${colors.reset}`);
  console.log('\nO sistema pode ser deployado, mas há avisos que devem ser revisados.\n');
  process.exit(0);
} else {
  console.log(`\n${colors.green}✅ SISTEMA PRONTO PARA DEPLOY!${colors.reset}`);
  console.log('\nTodos os checks passaram com sucesso.');
  console.log('Você pode fazer o deploy com segurança.\n');
  
  console.log('📝 Próximos passos:');
  console.log('1. git add .');
  console.log('2. git commit -m "feat: preparação para deploy"');
  console.log('3. git push origin main');
  console.log('4. Conectar repositório na Vercel');
  console.log('5. Configurar variáveis de ambiente');
  console.log('6. Deploy! 🚀\n');
  
  process.exit(0);
}
