#!/usr/bin/env node

/**
 * Script de Validação - Google Ads API v22
 * 
 * Valida se a implementação está em conformidade com as especificações
 * oficiais do Google Ads API v22
 */

const fs = require('fs');
const path = require('path');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkmark() {
  return `${colors.green}✓${colors.reset}`;
}

function crossmark() {
  return `${colors.red}✗${colors.reset}`;
}

function warning() {
  return `${colors.yellow}⚠${colors.reset}`;
}

// ============================================================================
// Validações
// ============================================================================

const validations = {
  // 1. Variáveis de Ambiente
  checkEnvironmentVariables() {
    log('\n📋 Verificando Variáveis de Ambiente...', 'cyan');
    
    const required = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_ADS_DEVELOPER_TOKEN',
      'NEXT_PUBLIC_APP_URL'
    ];
    
    const results = [];
    
    required.forEach(varName => {
      const value = process.env[varName];
      if (value && value !== 'your-value-here') {
        log(`  ${checkmark()} ${varName} configurado`);
        results.push(true);
      } else {
        log(`  ${crossmark()} ${varName} não configurado`, 'red');
        results.push(false);
      }
    });
    
    return results.every(r => r);
  },

  // 2. Estrutura de Arquivos
  checkFileStructure() {
    log('\n📁 Verificando Estrutura de Arquivos...', 'cyan');
    
    const requiredFiles = [
      'src/lib/google/client.ts',
      'src/lib/google/oauth.ts',
      'src/lib/google/token-manager.ts',
      'src/lib/google/error-handler.ts',
      'src/lib/google/crypto-service.ts',
      'src/lib/google/audit-service.ts',
      'src/lib/google/sync-service.ts',
      'src/app/api/google/auth/route.ts',
      'src/app/api/google/callback/route.ts',
      'src/app/api/google/accounts/route.ts',
      'database/google-ads-schema.sql',
    ];
    
    const results = [];
    
    requiredFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        log(`  ${checkmark()} ${file}`);
        results.push(true);
      } else {
        log(`  ${crossmark()} ${file} não encontrado`, 'red');
        results.push(false);
      }
    });
    
    return results.every(r => r);
  },

  // 3. Verificar Headers Obrigatórios no Client
  checkRequiredHeaders() {
    log('\n🔐 Verificando Headers Obrigatórios...', 'cyan');
    
    const clientPath = path.join(process.cwd(), 'src/lib/google/client.ts');
    
    if (!fs.existsSync(clientPath)) {
      log(`  ${crossmark()} client.ts não encontrado`, 'red');
      return false;
    }
    
    const content = fs.readFileSync(clientPath, 'utf8');
    
    const requiredHeaders = [
      { name: 'Authorization', pattern: /['"]Authorization['"]\s*:\s*`Bearer/ },
      { name: 'developer-token', pattern: /['"]developer-token['"]\s*:/ },
      { name: 'Content-Type', pattern: /['"]Content-Type['"]\s*:/ },
    ];
    
    const results = [];
    
    requiredHeaders.forEach(({ name, pattern }) => {
      if (pattern.test(content)) {
        log(`  ${checkmark()} Header "${name}" implementado`);
        results.push(true);
      } else {
        log(`  ${crossmark()} Header "${name}" não encontrado`, 'red');
        results.push(false);
      }
    });
    
    // Verificar login-customer-id (opcional mas recomendado)
    if (/['"]login-customer-id['"]\s*:/.test(content)) {
      log(`  ${checkmark()} Header "login-customer-id" implementado (MCC support)`);
    } else {
      log(`  ${warning()} Header "login-customer-id" não encontrado (opcional)`, 'yellow');
    }
    
    return results.every(r => r);
  },

  // 4. Verificar OAuth Scopes
  checkOAuthScopes() {
    log('\n🔑 Verificando OAuth Scopes...', 'cyan');
    
    const oauthPath = path.join(process.cwd(), 'src/lib/google/oauth.ts');
    
    if (!fs.existsSync(oauthPath)) {
      log(`  ${crossmark()} oauth.ts não encontrado`, 'red');
      return false;
    }
    
    const content = fs.readFileSync(oauthPath, 'utf8');
    
    // Escopo obrigatório
    const requiredScope = 'https://www.googleapis.com/auth/adwords';
    
    if (content.includes(requiredScope)) {
      log(`  ${checkmark()} Escopo obrigatório configurado: ${requiredScope}`);
      return true;
    } else {
      log(`  ${crossmark()} Escopo obrigatório não encontrado: ${requiredScope}`, 'red');
      return false;
    }
  },

  // 5. Verificar API Version
  checkApiVersion() {
    log('\n🔢 Verificando Versão da API...', 'cyan');
    
    const clientPath = path.join(process.cwd(), 'src/lib/google/client.ts');
    
    if (!fs.existsSync(clientPath)) {
      log(`  ${crossmark()} client.ts não encontrado`, 'red');
      return false;
    }
    
    const content = fs.readFileSync(clientPath, 'utf8');
    
    // Verificar se está usando v22
    if (/API_VERSION\s*=\s*['"]v22['"]/.test(content)) {
      log(`  ${checkmark()} Usando Google Ads API v22`);
      return true;
    } else if (/v\d+/.test(content)) {
      log(`  ${warning()} Versão da API diferente de v22 detectada`, 'yellow');
      return false;
    } else {
      log(`  ${crossmark()} Versão da API não especificada`, 'red');
      return false;
    }
  },

  // 6. Verificar Token Manager
  checkTokenManager() {
    log('\n🔄 Verificando Token Manager...', 'cyan');
    
    const tokenPath = path.join(process.cwd(), 'src/lib/google/token-manager.ts');
    
    if (!fs.existsSync(tokenPath)) {
      log(`  ${crossmark()} token-manager.ts não encontrado`, 'red');
      return false;
    }
    
    const content = fs.readFileSync(tokenPath, 'utf8');
    
    const features = [
      { name: 'Refresh automático', pattern: /refreshAccessToken|ensureValidToken/ },
      { name: 'Criptografia de tokens', pattern: /encrypt|decrypt/ },
      { name: 'Verificação de expiração', pattern: /isTokenExpired|expiresAt/ },
    ];
    
    const results = [];
    
    features.forEach(({ name, pattern }) => {
      if (pattern.test(content)) {
        log(`  ${checkmark()} ${name} implementado`);
        results.push(true);
      } else {
        log(`  ${crossmark()} ${name} não encontrado`, 'red');
        results.push(false);
      }
    });
    
    return results.every(r => r);
  },

  // 7. Verificar Database Schema
  checkDatabaseSchema() {
    log('\n🗄️  Verificando Database Schema...', 'cyan');
    
    const schemaPath = path.join(process.cwd(), 'database/google-ads-schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      log(`  ${crossmark()} google-ads-schema.sql não encontrado`, 'red');
      return false;
    }
    
    const content = fs.readFileSync(schemaPath, 'utf8');
    
    const requiredTables = [
      'google_ads_connections',
      'google_ads_campaigns',
      'google_ads_metrics',
      'google_ads_sync_logs',
    ];
    
    const results = [];
    
    requiredTables.forEach(table => {
      if (content.includes(table)) {
        log(`  ${checkmark()} Tabela "${table}" definida`);
        results.push(true);
      } else {
        log(`  ${crossmark()} Tabela "${table}" não encontrada`, 'red');
        results.push(false);
      }
    });
    
    // Verificar RLS
    if (/ROW LEVEL SECURITY/.test(content)) {
      log(`  ${checkmark()} Row Level Security (RLS) configurado`);
    } else {
      log(`  ${warning()} Row Level Security (RLS) não encontrado`, 'yellow');
    }
    
    return results.every(r => r);
  },

  // 8. Verificar Documentação
  checkDocumentation() {
    log('\n📚 Verificando Documentação...', 'cyan');
    
    const docs = [
      'docs/GOOGLE_ADS_V22_IMPLEMENTATION.md',
      'docs/GOOGLE_ADS_V22_SETUP_GUIDE.md',
      'docs/GOOGLE_ADS_V22_QUICK_REFERENCE.md',
    ];
    
    const results = [];
    
    docs.forEach(doc => {
      const docPath = path.join(process.cwd(), doc);
      if (fs.existsSync(docPath)) {
        log(`  ${checkmark()} ${doc}`);
        results.push(true);
      } else {
        log(`  ${warning()} ${doc} não encontrado`, 'yellow');
        results.push(false);
      }
    });
    
    return results.length > 0 && results.some(r => r);
  },

  // 9. Verificar Error Handling
  checkErrorHandling() {
    log('\n🚨 Verificando Error Handling...', 'cyan');
    
    const errorPath = path.join(process.cwd(), 'src/lib/google/error-handler.ts');
    
    if (!fs.existsSync(errorPath)) {
      log(`  ${crossmark()} error-handler.ts não encontrado`, 'red');
      return false;
    }
    
    const content = fs.readFileSync(errorPath, 'utf8');
    
    const errorCodes = [401, 403, 429, 500];
    const results = [];
    
    errorCodes.forEach(code => {
      if (content.includes(String(code))) {
        log(`  ${checkmark()} Tratamento para erro ${code} implementado`);
        results.push(true);
      } else {
        log(`  ${warning()} Tratamento para erro ${code} não encontrado`, 'yellow');
        results.push(false);
      }
    });
    
    return results.some(r => r);
  },

  // 10. Verificar Segurança
  checkSecurity() {
    log('\n🔒 Verificando Segurança...', 'cyan');
    
    const cryptoPath = path.join(process.cwd(), 'src/lib/google/crypto-service.ts');
    
    if (!fs.existsSync(cryptoPath)) {
      log(`  ${crossmark()} crypto-service.ts não encontrado`, 'red');
      return false;
    }
    
    const content = fs.readFileSync(cryptoPath, 'utf8');
    
    const securityFeatures = [
      { name: 'Criptografia AES', pattern: /aes|AES/ },
      { name: 'Rotação de chaves', pattern: /keyVersion|rotation/ },
      { name: 'Auditoria', pattern: /audit|log/ },
    ];
    
    const results = [];
    
    securityFeatures.forEach(({ name, pattern }) => {
      if (pattern.test(content)) {
        log(`  ${checkmark()} ${name} implementado`);
        results.push(true);
      } else {
        log(`  ${warning()} ${name} não encontrado`, 'yellow');
        results.push(false);
      }
    });
    
    return results.some(r => r);
  },
};

// ============================================================================
// Executar Validações
// ============================================================================

async function main() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║  Google Ads API v22 - Validação de Conformidade          ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');
  
  const results = {};
  
  // Executar todas as validações
  for (const [name, validation] of Object.entries(validations)) {
    try {
      results[name] = validation();
    } catch (error) {
      log(`\n  ${crossmark()} Erro ao executar ${name}: ${error.message}`, 'red');
      results[name] = false;
    }
  }
  
  // Resumo
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║  Resumo da Validação                                      ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');
  
  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(r => r).length;
  const failed = total - passed;
  
  log(`\n  Total de verificações: ${total}`);
  log(`  ${checkmark()} Aprovadas: ${passed}`, 'green');
  if (failed > 0) {
    log(`  ${crossmark()} Reprovadas: ${failed}`, 'red');
  }
  
  const percentage = Math.round((passed / total) * 100);
  log(`\n  Taxa de conformidade: ${percentage}%`, percentage >= 80 ? 'green' : 'yellow');
  
  if (percentage === 100) {
    log('\n  🎉 Parabéns! Implementação 100% conforme com Google Ads API v22!', 'green');
  } else if (percentage >= 80) {
    log('\n  ✅ Boa implementação! Algumas melhorias recomendadas.', 'green');
  } else if (percentage >= 60) {
    log('\n  ⚠️  Implementação parcial. Revise os itens reprovados.', 'yellow');
  } else {
    log('\n  ❌ Implementação incompleta. Muitos itens precisam de atenção.', 'red');
  }
  
  log('\n  Para mais informações, consulte:', 'cyan');
  log('  - docs/GOOGLE_ADS_V22_IMPLEMENTATION.md');
  log('  - docs/GOOGLE_ADS_V22_SETUP_GUIDE.md');
  log('  - https://developers.google.com/google-ads/api/docs/start\n');
  
  // Exit code
  process.exit(percentage >= 80 ? 0 : 1);
}

// Executar
main().catch(error => {
  log(`\n❌ Erro fatal: ${error.message}`, 'red');
  process.exit(1);
});
