#!/usr/bin/env node

/**
 * Google Ads API v22 Migration Test
 * Valida se a migração de v18 para v22 foi bem-sucedida
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function checkFileForVersion(filePath, expectedVersion = 'v22') {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Procurar por v18
    const hasV18 = /v18|API_VERSION\s*=\s*['"]v18['"]/.test(content);
    
    // Procurar por v22
    const hasV22 = /v22|API_VERSION\s*=\s*['"]v22['"]/.test(content);
    
    return {
      hasV18,
      hasV22,
      content
    };
  } catch (error) {
    return null;
  }
}

async function main() {
  log('\n🚀 Google Ads API v22 Migration Test\n', 'cyan');
  
  const filesToCheck = [
    'src/lib/google/ads-api.ts',
    'src/lib/sync/google-ads-sync-adapter.ts',
    'src/app/api/google/accounts-with-refresh/route.ts',
  ];
  
  let allPassed = true;
  
  log('📋 Verificando arquivos...\n', 'blue');
  
  for (const file of filesToCheck) {
    const filePath = path.join(process.cwd(), file);
    const result = checkFileForVersion(filePath);
    
    if (!result) {
      log(`  ❌ ${file} - Arquivo não encontrado`, 'red');
      allPassed = false;
      continue;
    }
    
    if (result.hasV18) {
      log(`  ❌ ${file} - Ainda contém referências a v18`, 'red');
      allPassed = false;
    } else if (result.hasV22) {
      log(`  ✅ ${file} - Migrado para v22`, 'green');
    } else {
      log(`  ⚠️  ${file} - Nenhuma versão encontrada`, 'yellow');
    }
  }
  
  log('\n📊 Verificando código para padrões de v18...\n', 'blue');
  
  // Procurar por padrões de v18 em todo o código
  const srcDir = path.join(process.cwd(), 'src');
  const v18Patterns = [
    'googleads.googleapis.com/v18',
    "API_VERSION = 'v18'",
    'API_VERSION = "v18"',
  ];
  
  let foundV18Patterns = false;
  
  function searchDirectory(dir) {
    try {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          if (!file.startsWith('.') && file !== 'node_modules') {
            searchDirectory(filePath);
          }
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
          const content = fs.readFileSync(filePath, 'utf8');
          
          for (const pattern of v18Patterns) {
            if (content.includes(pattern)) {
              log(`  ❌ Encontrado em ${filePath}: ${pattern}`, 'red');
              foundV18Patterns = true;
              allPassed = false;
            }
          }
        }
      }
    } catch (error) {
      // Ignorar erros de leitura
    }
  }
  
  searchDirectory(srcDir);
  
  if (!foundV18Patterns) {
    log('  ✅ Nenhuma referência a v18 encontrada no código', 'green');
  }
  
  log('\n📝 Verificando documentação...\n', 'blue');
  
  const docFile = path.join(process.cwd(), 'docs/GOOGLE_ADS_V22_MIGRATION.md');
  if (fs.existsSync(docFile)) {
    log('  ✅ Documentação de migração criada', 'green');
  } else {
    log('  ❌ Documentação de migração não encontrada', 'red');
    allPassed = false;
  }
  
  log('\n' + '='.repeat(60) + '\n', 'cyan');
  
  if (allPassed) {
    log('✅ Migração para v22 concluída com sucesso!', 'green');
    log('\n📌 Próximos passos:', 'blue');
    log('  1. Testar em staging: npm run test:staging', 'cyan');
    log('  2. Validar conexão com Google Ads API', 'cyan');
    log('  3. Monitorar logs em produção', 'cyan');
    process.exit(0);
  } else {
    log('❌ Migração incompleta. Verifique os erros acima.', 'red');
    process.exit(1);
  }
}

main().catch(error => {
  log(`\n❌ Erro: ${error.message}`, 'red');
  process.exit(1);
});
