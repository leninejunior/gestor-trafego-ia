#!/usr/bin/env node

/**
 * Pre-Deploy Check Script
 * Verifica se o sistema está pronto para deploy em produção
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando pré-requisitos para deploy...\n');

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
  '.env.production.example',
  'vercel.json',
];

essentialFiles.forEach(file => {
  if (fs.existsSync(file)) {
    success(`${file} existe`);
  } else {
    error(`${file} não encontrado`);
  }
});

// 2. Verificar package.json
console.log('\n📦 Verificando package.json...');

try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (pkg.scripts.build) {
    success('Script "build" configurado');
  } else {
    error('Script "build" não encontrado');
  }
  
  if (pkg.scripts.start) {
    success('Script "start" configurado');
  } else {
    error('Script "start" não encontrado');
  }
  
  // Verificar dependências críticas
  const criticalDeps = [
    'react',
    'react-dom',
    '@supabase/supabase-js',
    '@supabase/ssr',
  ];
  
  criticalDeps.forEach(dep => {
    if (pkg.dependencies[dep]) {
      success(`Dependência "${dep}" instalada`);
    } else {
      error(`Dependência "${dep}" não encontrada`);
    }
  });
  
  // Verificar Next.js (pode estar em dependencies ou devDependencies)
  if (pkg.dependencies.next || pkg.devDependencies.next) {
    success('Next.js instalado');
  } else {
    error('Next.js não encontrado');
  }
  
} catch (err) {
  error(`Erro ao ler package.json: ${err.message}`);
}

// 3. Verificar next.config.ts
console.log('\n⚙️  Verificando next.config.ts...');

try {
  const nextConfig = fs.readFileSync('next.config.ts', 'utf8');
  
  if (nextConfig.includes('ignoreBuildErrors: true')) {
    warning('TypeScript build errors estão sendo ignorados');
    info('Considere corrigir erros TypeScript antes do deploy');
  } else {
    success('Build errors não estão sendo ignorados');
  }
  
} catch (err) {
  error(`Erro ao ler next.config.ts: ${err.message}`);
}

// 4. Verificar variáveis de ambiente de exemplo
console.log('\n🔐 Verificando template de variáveis de ambiente...');

try {
  const envExample = fs.readFileSync('.env.production.example', 'utf8');
  
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'META_APP_ID',
    'META_APP_SECRET',
    'NEXT_PUBLIC_APP_URL',
  ];
  
  requiredVars.forEach(varName => {
    if (envExample.includes(varName)) {
      success(`Variável "${varName}" documentada`);
    } else {
      error(`Variável "${varName}" não documentada`);
    }
  });
  
} catch (err) {
  error(`Erro ao ler .env.production.example: ${err.message}`);
}

// 5. Verificar estrutura de diretórios
console.log('\n📂 Verificando estrutura de diretórios...');

const requiredDirs = [
  'src/app',
  'src/components',
  'src/lib',
  'database',
  'scripts',
];

requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    success(`Diretório "${dir}" existe`);
  } else {
    error(`Diretório "${dir}" não encontrado`);
  }
});

// 6. Verificar arquivos de schema do banco
console.log('\n🗄️  Verificando schemas do banco de dados...');

const schemaFiles = [
  'database/complete-schema.sql',
  'database/google-ads-schema.sql',
];

schemaFiles.forEach(file => {
  if (fs.existsSync(file)) {
    success(`Schema "${file}" existe`);
  } else {
    warning(`Schema "${file}" não encontrado (pode ser opcional)`);
  }
});

// 7. Verificar vercel.json
console.log('\n🚀 Verificando configuração Vercel...');

try {
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  
  if (vercelConfig.buildCommand) {
    success(`Build command: ${vercelConfig.buildCommand}`);
  } else {
    warning('Build command não especificado (usará padrão)');
  }
  
  if (vercelConfig.framework === 'nextjs') {
    success('Framework configurado como Next.js');
  } else {
    warning('Framework não especificado explicitamente');
  }
  
  if (vercelConfig.regions) {
    success(`Regiões configuradas: ${vercelConfig.regions.join(', ')}`);
  } else {
    info('Regiões não especificadas (usará padrão)');
  }
  
} catch (err) {
  warning(`Erro ao ler vercel.json: ${err.message}`);
}

// 8. Verificar se há arquivos .env locais (não devem ir para produção)
console.log('\n🔒 Verificando arquivos sensíveis...');

const sensitiveFiles = ['.env', '.env.local', '.env.production'];

sensitiveFiles.forEach(file => {
  if (fs.existsSync(file)) {
    warning(`Arquivo "${file}" existe localmente - NÃO commite este arquivo!`);
  }
});

// Verificar .gitignore
if (fs.existsSync('.gitignore')) {
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  
  if (gitignore.includes('.env')) {
    success('.env está no .gitignore');
  } else {
    error('.env NÃO está no .gitignore - RISCO DE SEGURANÇA!');
  }
} else {
  error('.gitignore não encontrado');
}

// 9. Resumo final
console.log('\n' + '='.repeat(60));
console.log('📊 RESUMO DA VERIFICAÇÃO');
console.log('='.repeat(60));

if (hasErrors) {
  console.log(`\n${colors.red}❌ DEPLOY BLOQUEADO - Corrija os erros acima${colors.reset}`);
  console.log('\nErros encontrados que impedem o deploy.');
  console.log('Corrija-os antes de prosseguir.\n');
  process.exit(1);
} else if (hasWarnings) {
  console.log(`\n${colors.yellow}⚠️  DEPLOY POSSÍVEL COM AVISOS${colors.reset}`);
  console.log('\nAvisos encontrados. Revise antes de fazer deploy.');
  console.log('O deploy pode prosseguir, mas recomenda-se revisar os avisos.\n');
  
  console.log('Deseja continuar? (y/n)');
  // Em ambiente CI/CD, sempre continua
  if (process.env.CI) {
    console.log('Ambiente CI detectado - continuando...\n');
    process.exit(0);
  }
  
  process.exit(0);
} else {
  console.log(`\n${colors.green}✅ SISTEMA PRONTO PARA DEPLOY!${colors.reset}`);
  console.log('\nTodas as verificações passaram.');
  console.log('Você pode prosseguir com o deploy.\n');
  
  console.log('Próximos passos:');
  console.log('1. Configure variáveis de ambiente na Vercel');
  console.log('2. Execute: npm run deploy');
  console.log('3. Aplique schemas no Supabase');
  console.log('4. Configure callbacks no Meta/Google Console');
  console.log('5. Teste a aplicação em produção\n');
  
  console.log('Consulte DEPLOY_PRODUCAO.md para instruções detalhadas.\n');
  
  process.exit(0);
}
