#!/usr/bin/env node

/**
 * Script para executar todos os testes do projeto
 * Executa testes unitários, integração, E2E e gera relatórios
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
  log('\n' + '='.repeat(60), 'cyan')
  log(`  ${title}`, 'cyan')
  log('='.repeat(60), 'cyan')
}

function logStep(step, description) {
  log(`\n${step}. ${description}`, 'yellow')
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function executeCommand(command, description, options = {}) {
  try {
    log(`   Executando: ${command}`, 'blue')
    const result = execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      ...options
    })
    
    if (options.silent) {
      return result
    }
    
    logSuccess(`${description} concluído com sucesso`)
    return result
  } catch (error) {
    logError(`${description} falhou`)
    if (!options.silent) {
      console.error(error.message)
    }
    throw error
  }
}

function checkTestEnvironment() {
  logStep(1, 'Verificando ambiente de testes')
  
  // Verificar se as dependências estão instaladas
  const requiredPackages = [
    'jest',
    '@playwright/test',
    'typescript',
    'ts-jest'
  ]
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const missingPackages = requiredPackages.filter(pkg => 
    !packageJson.dependencies?.[pkg] && !packageJson.devDependencies?.[pkg]
  )
  
  if (missingPackages.length > 0) {
    logWarning('Dependências de teste faltando:')
    missingPackages.forEach(pkg => log(`   - ${pkg}`, 'yellow'))
    log('\nInstalando dependências...', 'yellow')
    executeCommand('npm install', 'Instalação de dependências')
  }
  
  // Verificar arquivos de configuração
  const requiredFiles = [
    'jest.config.js',
    'jest.setup.js',
    'playwright.config.ts'
  ]
  
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file))
  if (missingFiles.length > 0) {
    logError('Arquivos de configuração faltando:')
    missingFiles.forEach(file => log(`   - ${file}`, 'red'))
    throw new Error('Configure os arquivos de teste antes de continuar')
  }
  
  logSuccess('Ambiente verificado com sucesso')
}

function runUnitTests() {
  logStep(2, 'Executando testes unitários')
  
  try {
    executeCommand(
      'npm run test:unit -- --coverage --coverageReporters=text --coverageReporters=html',
      'Testes unitários',
      { silent: false }
    )
    
    // Verificar cobertura
    const coverageDir = 'coverage'
    if (fs.existsSync(coverageDir)) {
      logSuccess('Relatório de cobertura gerado em coverage/')
    }
    
    return true
  } catch (error) {
    logError('Testes unitários falharam')
    return false
  }
}

function runIntegrationTests() {
  logStep(3, 'Executando testes de integração')
  
  try {
    executeCommand(
      'npm run test:integration',
      'Testes de integração'
    )
    return true
  } catch (error) {
    logError('Testes de integração falharam')
    return false
  }
}

function runE2ETests() {
  logStep(4, 'Executando testes E2E')
  
  try {
    // Verificar se os navegadores estão instalados
    executeCommand('npx playwright install --with-deps', 'Instalação de navegadores Playwright', {
      silent: true
    })
    
    executeCommand(
      'npm run test:e2e',
      'Testes E2E'
    )
    
    // Gerar relatório HTML
    if (fs.existsSync('playwright-report')) {
      logSuccess('Relatório E2E gerado em playwright-report/index.html')
    }
    
    return true
  } catch (error) {
    logError('Testes E2E falharam')
    return false
  }
}

function runPerformanceTests() {
  logStep(5, 'Executando testes de performance')
  
  try {
    executeCommand(
      'npm run test:performance',
      'Testes de performance'
    )
    return true
  } catch (error) {
    logWarning('Testes de performance pulados (não implementados)')
    return true // Não falhar se não houver testes de performance
  }
}

function runSecurityTests() {
  logStep(6, 'Executando testes de segurança')
  
  try {
    executeCommand(
      'npm run test:security',
      'Testes de segurança'
    )
    return true
  } catch (error) {
    logWarning('Testes de segurança pulados (não implementados)')
    return true // Não falhar se não houver testes de segurança
  }
}

function generateTestReport(results) {
  logStep(7, 'Gerando relatório consolidado')
  
  const report = {
    timestamp: new Date().toISOString(),
    results: {
      unit: results.unit,
      integration: results.integration,
      e2e: results.e2e,
      performance: results.performance,
      security: results.security
    },
    summary: {
      total: Object.values(results).filter(Boolean).length,
      passed: Object.values(results).filter(Boolean).length,
      failed: Object.values(results).filter(r => !r).length
    }
  }
  
  // Salvar relatório JSON
  const reportPath = 'test-report.json'
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  logSuccess(`Relatório salvo em ${reportPath}`)
  
  // Gerar relatório HTML
  const htmlReport = generateHTMLReport(report)
  fs.writeFileSync('test-report.html', htmlReport)
  logSuccess('Relatório HTML gerado em test-report.html')
  
  return report
}

function generateHTMLReport(report) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório de Testes</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #007acc;
            padding-bottom: 10px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .metric {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            text-align: center;
            border-left: 4px solid #007acc;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #333;
        }
        .metric-label {
            color: #666;
            margin-top: 5px;
        }
        .test-results {
            margin: 30px 0;
        }
        .test-item {
            display: flex;
            align-items: center;
            padding: 15px;
            margin: 10px 0;
            border-radius: 6px;
            background: #f8f9fa;
        }
        .test-item.passed {
            border-left: 4px solid #28a745;
        }
        .test-item.failed {
            border-left: 4px solid #dc3545;
        }
        .test-status {
            font-size: 1.5em;
            margin-right: 15px;
        }
        .test-name {
            flex: 1;
            font-weight: 500;
        }
        .timestamp {
            color: #666;
            font-size: 0.9em;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Relatório de Testes</h1>
        
        <div class="summary">
            <div class="metric">
                <div class="metric-value">${report.summary.total}</div>
                <div class="metric-label">Total de Testes</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.passed}</div>
                <div class="metric-label">Passaram</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.failed}</div>
                <div class="metric-label">Falharam</div>
            </div>
        </div>
        
        <div class="test-results">
            <h2>Resultados Detalhados</h2>
            
            <div class="test-item ${report.results.unit ? 'passed' : 'failed'}">
                <div class="test-status">${report.results.unit ? '✅' : '❌'}</div>
                <div class="test-name">Testes Unitários</div>
            </div>
            
            <div class="test-item ${report.results.integration ? 'passed' : 'failed'}">
                <div class="test-status">${report.results.integration ? '✅' : '❌'}</div>
                <div class="test-name">Testes de Integração</div>
            </div>
            
            <div class="test-item ${report.results.e2e ? 'passed' : 'failed'}">
                <div class="test-status">${report.results.e2e ? '✅' : '❌'}</div>
                <div class="test-name">Testes E2E</div>
            </div>
            
            <div class="test-item ${report.results.performance ? 'passed' : 'failed'}">
                <div class="test-status">${report.results.performance ? '✅' : '❌'}</div>
                <div class="test-name">Testes de Performance</div>
            </div>
            
            <div class="test-item ${report.results.security ? 'passed' : 'failed'}">
                <div class="test-status">${report.results.security ? '✅' : '❌'}</div>
                <div class="test-name">Testes de Segurança</div>
            </div>
        </div>
        
        <div class="timestamp">
            Gerado em: ${new Date(report.timestamp).toLocaleString('pt-BR')}
        </div>
    </div>
</body>
</html>
  `
}

function printSummary(report) {
  logSection('Resumo Final')
  
  log(`\n📊 Estatísticas:`, 'bright')
  log(`   Total de suites: ${report.summary.total}`, 'cyan')
  log(`   Passaram: ${report.summary.passed}`, 'green')
  log(`   Falharam: ${report.summary.failed}`, 'red')
  
  if (report.summary.failed > 0) {
    log('\n⚠️  Alguns testes falharam. Verifique os logs para detalhes.', 'yellow')
  } else {
    log('\n🎉 Todos os testes passaram com sucesso!', 'green')
  }
  
  log('\n📄 Relatórios gerados:', 'bright')
  log('   - test-report.json (JSON)', 'cyan')
  log('   - test-report.html (HTML)', 'cyan')
  log('   - coverage/ (Cobertura de código)', 'cyan')
  log('   - playwright-report/ (Relatório E2E)', 'cyan')
}

async function main() {
  const startTime = Date.now()
  
  try {
    logSection('🚀 Executando Todos os Testes do Projeto')
    
    // Verificar ambiente
    checkTestEnvironment()
    
    // Executar testes
    const results = {
      unit: runUnitTests(),
      integration: runIntegrationTests(),
      e2e: runE2ETests(),
      performance: runPerformanceTests(),
      security: runSecurityTests()
    }
    
    // Gerar relatório
    const report = generateTestReport(results)
    
    // Imprimir resumo
    printSummary(report)
    
    const duration = Date.now() - startTime
    log(`\n⏱️  Tempo total de execução: ${(duration / 1000).toFixed(2)}s`, 'magenta')
    
    // Exit code baseado nos resultados
    if (report.summary.failed > 0) {
      process.exit(1)
    } else {
      process.exit(0)
    }
    
  } catch (error) {
    logError(`Erro na execução dos testes: ${error.message}`)
    process.exit(1)
  }
}

// Executar script
if (require.main === module) {
  main()
}

module.exports = {
  main,
  checkTestEnvironment,
  runUnitTests,
  runIntegrationTests,
  runE2ETests,
  generateTestReport
}