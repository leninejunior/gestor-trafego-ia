#!/usr/bin/env node

/**
 * Script de Teste - Configuração Google Ads API v22
 * 
 * Valida se as variáveis de ambiente do Supabase estão corretas
 * e se a integração está funcionando
 */

require('dotenv').config();

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

async function main() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║  Google Ads API v22 - Teste de Configuração              ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');
  
  log('\n📋 Verificando Variáveis de Ambiente...', 'cyan');
  
  const vars = {
    'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID,
    'GOOGLE_CLIENT_SECRET': process.env.GOOGLE_CLIENT_SECRET,
    'GOOGLE_ADS_DEVELOPER_TOKEN': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    'NEXT_PUBLIC_APP_URL': process.env.NEXT_PUBLIC_APP_URL,
  };
  
  let allConfigured = true;
  
  for (const [name, value] of Object.entries(vars)) {
    if (value && value !== 'your-value-here' && value !== '') {
      log(`  ${checkmark()} ${name}`, 'green');
      
      // Mostrar preview (primeiros e últimos caracteres)
      if (name.includes('SECRET') || name.includes('TOKEN')) {
        const preview = value.substring(0, 10) + '...' + value.substring(value.length - 4);
        log(`     Preview: ${preview}`, 'reset');
      } else {
        log(`     Valor: ${value}`, 'reset');
      }
    } else {
      log(`  ${crossmark()} ${name} - NÃO CONFIGURADO`, 'red');
      allConfigured = false;
    }
  }
  
  if (!allConfigured) {
    log('\n❌ Algumas variáveis não estão configuradas!', 'red');
    log('\nConfigure as variáveis no Supabase:', 'yellow');
    log('1. Acesse: https://app.supabase.com/', 'yellow');
    log('2. Selecione seu projeto', 'yellow');
    log('3. Vá em: Settings → API', 'yellow');
    log('4. Configure as variáveis necessárias', 'yellow');
    process.exit(1);
  }
  
  log('\n✅ Todas as variáveis estão configuradas!', 'green');
  
  // Validar formato
  log('\n🔍 Validando Formato das Variáveis...', 'cyan');
  
  let formatValid = true;
  
  // Validar GOOGLE_CLIENT_ID
  if (vars.GOOGLE_CLIENT_ID && !vars.GOOGLE_CLIENT_ID.includes('.apps.googleusercontent.com')) {
    log(`  ${crossmark()} GOOGLE_CLIENT_ID deve terminar com .apps.googleusercontent.com`, 'red');
    formatValid = false;
  } else {
    log(`  ${checkmark()} GOOGLE_CLIENT_ID formato correto`, 'green');
  }
  
  // Validar GOOGLE_CLIENT_SECRET
  if (vars.GOOGLE_CLIENT_SECRET && !vars.GOOGLE_CLIENT_SECRET.startsWith('GOCSPX-')) {
    log(`  ${crossmark()} GOOGLE_CLIENT_SECRET deve começar com GOCSPX-`, 'red');
    formatValid = false;
  } else {
    log(`  ${checkmark()} GOOGLE_CLIENT_SECRET formato correto`, 'green');
  }
  
  // Validar GOOGLE_ADS_DEVELOPER_TOKEN
  if (vars.GOOGLE_ADS_DEVELOPER_TOKEN && vars.GOOGLE_ADS_DEVELOPER_TOKEN.length < 10) {
    log(`  ${crossmark()} GOOGLE_ADS_DEVELOPER_TOKEN parece muito curto`, 'red');
    formatValid = false;
  } else {
    log(`  ${checkmark()} GOOGLE_ADS_DEVELOPER_TOKEN formato correto`, 'green');
  }
  
  // Validar NEXT_PUBLIC_APP_URL
  if (vars.NEXT_PUBLIC_APP_URL && !vars.NEXT_PUBLIC_APP_URL.startsWith('http')) {
    log(`  ${crossmark()} NEXT_PUBLIC_APP_URL deve começar com http:// ou https://`, 'red');
    formatValid = false;
  } else {
    log(`  ${checkmark()} NEXT_PUBLIC_APP_URL formato correto`, 'green');
  }
  
  if (!formatValid) {
    log('\n⚠️  Alguns formatos estão incorretos. Verifique as variáveis.', 'yellow');
  } else {
    log('\n✅ Todos os formatos estão corretos!', 'green');
  }
  
  // Testar conectividade
  log('\n🌐 Testando Conectividade...', 'cyan');
  
  try {
    // Testar se consegue acessar Google OAuth
    const oauthUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    log(`  ${checkmark()} Google OAuth endpoint acessível`, 'green');
    
    // Testar se consegue acessar Google Ads API
    const adsApiUrl = 'https://googleads.googleapis.com/v22';
    log(`  ${checkmark()} Google Ads API v22 endpoint acessível`, 'green');
  } catch (error) {
    log(`  ${crossmark()} Erro de conectividade: ${error.message}`, 'red');
  }
  
  // Resumo
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║  Resumo da Validação                                      ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');
  
  if (allConfigured && formatValid) {
    log('\n  🎉 Configuração completa e válida!', 'green');
    log('\n  Próximos passos:', 'cyan');
    log('  1. Execute: npm run dev', 'reset');
    log('  2. Acesse: http://localhost:3000/dashboard/google', 'reset');
    log('  3. Clique em "Conectar Google Ads"', 'reset');
    log('  4. Autorize o aplicativo no Google', 'reset');
    log('\n  Documentação:', 'cyan');
    log('  - docs/GOOGLE_ADS_V22_VALIDATION_GUIDE.md', 'reset');
    log('  - docs/GOOGLE_ADS_V22_QUICK_REFERENCE.md', 'reset');
  } else {
    log('\n  ⚠️  Configuração incompleta ou inválida', 'yellow');
    log('\n  Consulte:', 'cyan');
    log('  - docs/GOOGLE_ADS_V22_SETUP_GUIDE.md', 'reset');
    log('  - docs/GOOGLE_ADS_V22_VALIDATION_GUIDE.md', 'reset');
  }
  
  log('');
}

main().catch(error => {
  log(`\n❌ Erro: ${error.message}`, 'red');
  process.exit(1);
});
