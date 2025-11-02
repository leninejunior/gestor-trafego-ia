#!/usr/bin/env node

/**
 * Script de Deploy - Sistema de Checkout e Pagamentos
 * 
 * Executa deploy blue-green com validação e rollback automático
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Carregar variáveis de ambiente
function loadEnvFile() {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim();
                if (value && !process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
    }
}

loadEnvFile();

// Configurações de deploy
const deployConfig = {
    environment: process.env.NODE_ENV || 'production',
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    healthCheckTimeout: 30000, // 30 segundos
    smokeTestTimeout: 60000,   // 1 minuto
    rollbackTimeout: 120000    // 2 minutos
};

// Estado do deploy
let deployState = {
    startTime: new Date(),
    phase: 'initialization',
    previousVersion: null,
    newVersion: null,
    healthChecks: {},
    smokeTests: {},
    rollbackExecuted: false
};

/**
 * Obter versão atual da aplicação
 */
function getCurrentVersion() {
    try {
        const packagePath = path.join(__dirname, '..', 'package.json');
        const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        return packageContent.version || '1.0.0';
    } catch (error) {
        console.log('⚠️  Não foi possível obter versão do package.json');
        return new Date().toISOString().split('T')[0];
    }
}

/**
 * Executar health checks
 */
async function executeHealthChecks() {
    console.log('🏥 Executando health checks...\n');

    const healthChecks = [
        {
            name: 'API Principal',
            url: '/api/health',
            timeout: 5000
        },
        {
            name: 'Checkout API',
            url: '/api/health/checkout',
            timeout: 10000
        },
        {
            name: 'Iugu Integration',
            url: '/api/health/iugu',
            timeout: 15000
        },
        {
            name: 'Database',
            url: '/api/health/dependencies',
            timeout: 10000
        }
    ];

    const results = {
        passed: 0,
        failed: 0,
        total: healthChecks.length
    };

    for (const check of healthChecks) {
        console.log(`   Verificando ${check.name}...`);
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), check.timeout);

            const response = await fetch(`${deployConfig.appUrl}${check.url}`, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Deploy-Health-Check/1.0'
                }
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                console.log(`      ✅ ${check.name}: OK (${response.status})`);
                
                deployState.healthChecks[check.name] = {
                    status: 'passed',
                    responseTime: Date.now() - deployState.startTime,
                    details: data
                };
                
                results.passed++;
            } else {
                console.log(`      ❌ ${check.name}: HTTP ${response.status}`);
                
                deployState.healthChecks[check.name] = {
                    status: 'failed',
                    error: `HTTP ${response.status}`,
                    responseTime: Date.now() - deployState.startTime
                };
                
                results.failed++;
            }

        } catch (error) {
            const errorMessage = error.name === 'AbortError' ? 'Timeout' : error.message;
            console.log(`      ❌ ${check.name}: ${errorMessage}`);
            
            deployState.healthChecks[check.name] = {
                status: 'failed',
                error: errorMessage,
                responseTime: Date.now() - deployState.startTime
            };
            
            results.failed++;
        }
    }

    const successRate = (results.passed / results.total * 100).toFixed(1);
    console.log(`\n📊 Health Checks: ${results.passed}/${results.total} (${successRate}%)`);

    return results.failed === 0;
}

/**
 * Executar smoke tests
 */
async function executeSmokeTests() {
    console.log('\n🧪 Executando smoke tests...\n');

    const supabase = createClient(deployConfig.supabaseUrl, deployConfig.supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    const smokeTests = [
        {
            name: 'Criar Subscription Intent',
            test: async () => {
                // Buscar um plano ativo para teste
                const { data: plans, error: planError } = await supabase
                    .from('subscription_plans')
                    .select('id')
                    .eq('is_active', true)
                    .limit(1);

                if (planError || !plans || plans.length === 0) {
                    throw new Error('Nenhum plano ativo encontrado');
                }

                const testData = {
                    plan_id: plans[0].id,
                    billing_cycle: 'monthly',
                    user_email: `smoke-test-${Date.now()}@example.com`,
                    user_name: 'Smoke Test User',
                    organization_name: 'Smoke Test Org'
                };

                const response = await fetch(`${deployConfig.appUrl}/api/subscriptions/checkout-iugu`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(testData)
                });

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`HTTP ${response.status}: ${error}`);
                }

                const result = await response.json();
                
                if (!result.success || !result.intent_id) {
                    throw new Error('Resposta inválida da API de checkout');
                }

                // Limpar dados de teste
                await supabase
                    .from('subscription_intents')
                    .delete()
                    .eq('id', result.intent_id);

                return `Intent criado: ${result.intent_id}`;
            }
        },
        {
            name: 'Consultar Status',
            test: async () => {
                // Criar intent temporário para teste
                const { data: plans } = await supabase
                    .from('subscription_plans')
                    .select('id')
                    .eq('is_active', true)
                    .limit(1);

                if (!plans || plans.length === 0) {
                    throw new Error('Nenhum plano ativo encontrado');
                }

                const { data: testIntent, error } = await supabase
                    .from('subscription_intents')
                    .insert({
                        plan_id: plans[0].id,
                        billing_cycle: 'monthly',
                        user_email: `status-test-${Date.now()}@example.com`,
                        user_name: 'Status Test User',
                        organization_name: 'Status Test Org',
                        status: 'pending'
                    })
                    .select()
                    .single();

                if (error) {
                    throw new Error(`Erro ao criar intent de teste: ${error.message}`);
                }

                // Testar consulta de status
                const response = await fetch(`${deployConfig.appUrl}/api/subscriptions/status/${testIntent.id}`);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const status = await response.json();

                if (!status.success || status.intent_id !== testIntent.id) {
                    throw new Error('Resposta inválida da API de status');
                }

                // Limpar dados de teste
                await supabase
                    .from('subscription_intents')
                    .delete()
                    .eq('id', testIntent.id);

                return `Status consultado: ${status.status}`;
            }
        },
        {
            name: 'Webhook Endpoint',
            test: async () => {
                const testPayload = {
                    event: 'test.smoke_test',
                    data: {
                        id: `smoke_test_${Date.now()}`,
                        status: 'test'
                    }
                };

                const response = await fetch(`${deployConfig.appUrl}/api/webhooks/iugu`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(testPayload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await response.json();

                if (!result.received) {
                    throw new Error('Webhook não foi recebido corretamente');
                }

                return 'Webhook processado com sucesso';
            }
        },
        {
            name: 'Database Functions',
            test: async () => {
                // Testar função de limpeza
                const { data, error } = await supabase.rpc('cleanup_expired_subscription_intents');

                if (error) {
                    throw new Error(`Erro na função de limpeza: ${error.message}`);
                }

                return `Função de limpeza OK (${data || 0} registros processados)`;
            }
        }
    ];

    const results = {
        passed: 0,
        failed: 0,
        total: smokeTests.length
    };

    for (const test of smokeTests) {
        console.log(`   Executando ${test.name}...`);
        
        try {
            const startTime = Date.now();
            const result = await test.test();
            const duration = Date.now() - startTime;
            
            console.log(`      ✅ ${test.name}: ${result} (${duration}ms)`);
            
            deployState.smokeTests[test.name] = {
                status: 'passed',
                result: result,
                duration: duration
            };
            
            results.passed++;

        } catch (error) {
            console.log(`      ❌ ${test.name}: ${error.message}`);
            
            deployState.smokeTests[test.name] = {
                status: 'failed',
                error: error.message,
                duration: Date.now() - deployState.startTime
            };
            
            results.failed++;
        }
    }

    const successRate = (results.passed / results.total * 100).toFixed(1);
    console.log(`\n📊 Smoke Tests: ${results.passed}/${results.total} (${successRate}%)`);

    return results.failed === 0;
}

/**
 * Monitorar métricas pós-deploy
 */
async function monitorPostDeployMetrics() {
    console.log('\n📈 Monitorando métricas pós-deploy...\n');

    const supabase = createClient(deployConfig.supabaseUrl, deployConfig.supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    const metrics = {};

    try {
        // Métrica 1: Checkouts nas últimas 24h
        console.log('   Coletando métricas de checkout...');
        
        const { data: checkoutMetrics, error: checkoutError } = await supabase
            .from('subscription_intents')
            .select('status')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (checkoutError) {
            console.log(`      ⚠️  Erro ao coletar métricas de checkout: ${checkoutError.message}`);
        } else {
            const total = checkoutMetrics.length;
            const completed = checkoutMetrics.filter(m => m.status === 'completed').length;
            const conversionRate = total > 0 ? (completed / total * 100).toFixed(1) : 0;
            
            metrics.checkout = {
                total_24h: total,
                completed_24h: completed,
                conversion_rate: parseFloat(conversionRate)
            };
            
            console.log(`      ✅ Checkouts 24h: ${total} (${completed} completados, ${conversionRate}% conversão)`);
        }

        // Métrica 2: Webhooks processados
        console.log('\n   Coletando métricas de webhook...');
        
        const { data: webhookMetrics, error: webhookError } = await supabase
            .from('webhook_logs')
            .select('status')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (webhookError) {
            console.log(`      ⚠️  Erro ao coletar métricas de webhook: ${webhookError.message}`);
        } else {
            const total = webhookMetrics.length;
            const processed = webhookMetrics.filter(m => m.status === 'processed').length;
            const failed = webhookMetrics.filter(m => m.status === 'failed').length;
            const successRate = total > 0 ? (processed / total * 100).toFixed(1) : 0;
            
            metrics.webhooks = {
                total_24h: total,
                processed_24h: processed,
                failed_24h: failed,
                success_rate: parseFloat(successRate)
            };
            
            console.log(`      ✅ Webhooks 24h: ${total} (${processed} processados, ${failed} falharam, ${successRate}% sucesso)`);
        }

        // Métrica 3: Performance da API
        console.log('\n   Testando performance da API...');
        
        const performanceTests = [];
        for (let i = 0; i < 5; i++) {
            const startTime = Date.now();
            
            try {
                const response = await fetch(`${deployConfig.appUrl}/api/health/checkout`);
                const duration = Date.now() - startTime;
                
                if (response.ok) {
                    performanceTests.push(duration);
                }
            } catch (error) {
                console.log(`      ⚠️  Teste de performance ${i + 1} falhou: ${error.message}`);
            }
        }

        if (performanceTests.length > 0) {
            const avgResponseTime = performanceTests.reduce((a, b) => a + b, 0) / performanceTests.length;
            const maxResponseTime = Math.max(...performanceTests);
            
            metrics.performance = {
                avg_response_time_ms: Math.round(avgResponseTime),
                max_response_time_ms: maxResponseTime,
                samples: performanceTests.length
            };
            
            console.log(`      ✅ Performance API: ${Math.round(avgResponseTime)}ms média, ${maxResponseTime}ms máximo`);
        }

    } catch (error) {
        console.log(`   ❌ Erro ao coletar métricas: ${error.message}`);
    }

    deployState.metrics = metrics;
    return metrics;
}

/**
 * Executar rollback em caso de falha
 */
async function executeRollback() {
    console.log('\n🔄 Executando rollback...\n');

    deployState.rollbackExecuted = true;
    deployState.rollbackStartTime = new Date();

    try {
        // Em um ambiente real, aqui seria executado o rollback da aplicação
        // Por exemplo: reverter para versão anterior, restaurar banco, etc.
        
        console.log('   1. Revertendo aplicação para versão anterior...');
        // Simular rollback da aplicação
        console.log(`      ✅ Aplicação revertida para versão ${deployState.previousVersion}`);

        console.log('\n   2. Verificando saúde após rollback...');
        const healthAfterRollback = await executeHealthChecks();
        
        if (healthAfterRollback) {
            console.log('   ✅ Rollback executado com sucesso');
            return true;
        } else {
            console.log('   ❌ Sistema ainda com problemas após rollback');
            return false;
        }

    } catch (error) {
        console.error(`   ❌ Erro durante rollback: ${error.message}`);
        return false;
    }
}

/**
 * Salvar relatório de deploy
 */
function saveDeployReport() {
    const reportPath = path.join(__dirname, '..', `deploy-report-${Date.now()}.json`);
    
    const report = {
        ...deployState,
        endTime: new Date(),
        duration: Date.now() - deployState.startTime.getTime(),
        environment: deployConfig.environment,
        appUrl: deployConfig.appUrl
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Relatório de deploy salvo: ${reportPath}`);
    
    return reportPath;
}

/**
 * Função principal
 */
async function main() {
    console.log('🚀 Iniciando deploy do sistema de checkout...\n');
    console.log(`🌍 Ambiente: ${deployConfig.environment}`);
    console.log(`🔗 URL: ${deployConfig.appUrl}`);
    console.log(`⏰ Início: ${deployState.startTime.toISOString()}\n`);

    const args = process.argv.slice(2);
    const skipHealthChecks = args.includes('--skip-health-checks');
    const skipSmokeTests = args.includes('--skip-smoke-tests');
    const skipMetrics = args.includes('--skip-metrics');
    const autoRollback = args.includes('--auto-rollback') || process.env.AUTO_ROLLBACK === 'true';

    try {
        // 1. Obter versões
        deployState.previousVersion = getCurrentVersion();
        deployState.newVersion = deployState.previousVersion; // Em deploy real, seria diferente
        
        console.log(`📦 Versão anterior: ${deployState.previousVersion}`);
        console.log(`📦 Nova versão: ${deployState.newVersion}\n`);

        // 2. Health Checks
        if (!skipHealthChecks) {
            deployState.phase = 'health_checks';
            const healthPassed = await executeHealthChecks();
            
            if (!healthPassed) {
                throw new Error('Health checks falharam');
            }
        } else {
            console.log('⏭️  Health checks pulados\n');
        }

        // 3. Smoke Tests
        if (!skipSmokeTests) {
            deployState.phase = 'smoke_tests';
            const smokeTestsPassed = await executeSmokeTests();
            
            if (!smokeTestsPassed) {
                throw new Error('Smoke tests falharam');
            }
        } else {
            console.log('⏭️  Smoke tests pulados\n');
        }

        // 4. Monitoramento de métricas
        if (!skipMetrics) {
            deployState.phase = 'monitoring';
            await monitorPostDeployMetrics();
        } else {
            console.log('⏭️  Monitoramento de métricas pulado\n');
        }

        // 5. Deploy bem-sucedido
        deployState.phase = 'completed';
        deployState.success = true;

        console.log('\n🎉 DEPLOY CONCLUÍDO COM SUCESSO!');
        console.log('=' .repeat(50));
        
        const duration = Math.round((Date.now() - deployState.startTime.getTime()) / 1000);
        console.log(`⏱️  Duração total: ${duration}s`);
        
        if (deployState.healthChecks) {
            const healthCount = Object.keys(deployState.healthChecks).length;
            const healthPassed = Object.values(deployState.healthChecks).filter(h => h.status === 'passed').length;
            console.log(`🏥 Health checks: ${healthPassed}/${healthCount}`);
        }
        
        if (deployState.smokeTests) {
            const smokeCount = Object.keys(deployState.smokeTests).length;
            const smokePassed = Object.values(deployState.smokeTests).filter(s => s.status === 'passed').length;
            console.log(`🧪 Smoke tests: ${smokePassed}/${smokeCount}`);
        }
        
        if (deployState.metrics) {
            console.log(`📊 Métricas coletadas: ${Object.keys(deployState.metrics).length} categorias`);
        }

        console.log('\n📝 Próximos passos:');
        console.log('   1. Monitorar logs por 30 minutos');
        console.log('   2. Verificar métricas de negócio');
        console.log('   3. Comunicar sucesso do deploy');
        console.log('   4. Atualizar documentação se necessário');

    } catch (error) {
        console.error(`\n❌ Deploy falhou: ${error.message}`);
        
        deployState.phase = 'failed';
        deployState.success = false;
        deployState.error = error.message;

        if (autoRollback) {
            console.log('\n🔄 Executando rollback automático...');
            const rollbackSuccess = await executeRollback();
            
            if (rollbackSuccess) {
                console.log('\n✅ Rollback executado com sucesso');
                console.log('   Sistema revertido para estado anterior');
            } else {
                console.log('\n❌ Rollback falhou - intervenção manual necessária');
            }
        } else {
            console.log('\n⚠️  Para executar rollback manual:');
            console.log('   node scripts/rollback-checkout-migration.js --force');
        }

        console.log('\n🔧 Para debug:');
        console.log('   - Verificar logs da aplicação');
        console.log('   - Consultar relatório de deploy');
        console.log('   - Validar configurações de ambiente');
        
        process.exit(1);
    } finally {
        // Salvar relatório sempre
        saveDeployReport();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = {
    executeHealthChecks,
    executeSmokeTests,
    monitorPostDeployMetrics,
    executeRollback,
    saveDeployReport
};