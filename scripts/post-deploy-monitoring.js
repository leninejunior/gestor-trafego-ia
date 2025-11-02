#!/usr/bin/env node

/**
 * Script de Monitoramento Pós-Deploy
 * 
 * Monitora métricas críticas após deploy e gera alertas se necessário
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

if (!supabaseUrl || !supabaseServiceKey || !appUrl) {
    console.error('❌ Variáveis de ambiente não configuradas');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Configurações de monitoramento
const monitoringConfig = {
    checkInterval: 30000,        // 30 segundos
    alertThresholds: {
        errorRate: 5,            // 5% de taxa de erro
        responseTime: 5000,      // 5 segundos
        conversionRate: 70,      // 70% de conversão mínima
        webhookFailureRate: 10   // 10% de falha de webhook
    },
    monitoringDuration: 30 * 60 * 1000, // 30 minutos
    maxConsecutiveFailures: 3
};

// Estado do monitoramento
let monitoringState = {
    startTime: new Date(),
    checks: [],
    alerts: [],
    consecutiveFailures: 0,
    isHealthy: true
};

/**
 * Verificar saúde da API
 */
async function checkApiHealth() {
    const healthCheck = {
        timestamp: new Date(),
        type: 'api_health',
        results: {}
    };

    const endpoints = [
        { name: 'main', url: '/api/health' },
        { name: 'checkout', url: '/api/health/checkout' },
        { name: 'iugu', url: '/api/health/iugu' },
        { name: 'dependencies', url: '/api/health/dependencies' }
    ];

    let totalChecks = 0;
    let passedChecks = 0;

    for (const endpoint of endpoints) {
        const startTime = Date.now();
        
        try {
            const response = await fetch(`${appUrl}${endpoint.url}`, {
                timeout: 10000
            });
            
            const responseTime = Date.now() - startTime;
            const isHealthy = response.ok && responseTime < monitoringConfig.alertThresholds.responseTime;
            
            healthCheck.results[endpoint.name] = {
                status: response.ok ? 'healthy' : 'unhealthy',
                responseTime: responseTime,
                httpStatus: response.status,
                isHealthy: isHealthy
            };

            totalChecks++;
            if (isHealthy) passedChecks++;

        } catch (error) {
            healthCheck.results[endpoint.name] = {
                status: 'error',
                error: error.message,
                isHealthy: false
            };
            totalChecks++;
        }
    }

    healthCheck.overallHealth = passedChecks / totalChecks;
    healthCheck.isHealthy = healthCheck.overallHealth >= 0.75; // 75% dos checks devem passar

    return healthCheck;
}

/**
 * Verificar métricas de negócio
 */
async function checkBusinessMetrics() {
    const metricsCheck = {
        timestamp: new Date(),
        type: 'business_metrics',
        results: {}
    };

    try {
        // Métricas de checkout (última hora)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        const { data: checkoutData, error: checkoutError } = await supabase
            .from('subscription_intents')
            .select('status, created_at')
            .gte('created_at', oneHourAgo);

        if (checkoutError) {
            metricsCheck.results.checkout = {
                status: 'error',
                error: checkoutError.message
            };
        } else {
            const total = checkoutData.length;
            const completed = checkoutData.filter(item => item.status === 'completed').length;
            const failed = checkoutData.filter(item => item.status === 'failed').length;
            
            const conversionRate = total > 0 ? (completed / total * 100) : 100;
            const errorRate = total > 0 ? (failed / total * 100) : 0;

            metricsCheck.results.checkout = {
                status: 'healthy',
                total: total,
                completed: completed,
                failed: failed,
                conversionRate: Math.round(conversionRate * 100) / 100,
                errorRate: Math.round(errorRate * 100) / 100,
                isHealthy: conversionRate >= monitoringConfig.alertThresholds.conversionRate &&
                          errorRate <= monitoringConfig.alertThresholds.errorRate
            };
        }

        // Métricas de webhook (última hora)
        const { data: webhookData, error: webhookError } = await supabase
            .from('webhook_logs')
            .select('status, created_at')
            .gte('created_at', oneHourAgo);

        if (webhookError) {
            metricsCheck.results.webhooks = {
                status: 'error',
                error: webhookError.message
            };
        } else {
            const total = webhookData.length;
            const processed = webhookData.filter(item => item.status === 'processed').length;
            const failed = webhookData.filter(item => item.status === 'failed').length;
            
            const successRate = total > 0 ? (processed / total * 100) : 100;
            const failureRate = total > 0 ? (failed / total * 100) : 0;

            metricsCheck.results.webhooks = {
                status: 'healthy',
                total: total,
                processed: processed,
                failed: failed,
                successRate: Math.round(successRate * 100) / 100,
                failureRate: Math.round(failureRate * 100) / 100,
                isHealthy: failureRate <= monitoringConfig.alertThresholds.webhookFailureRate
            };
        }

    } catch (error) {
        metricsCheck.results.error = {
            status: 'error',
            error: error.message
        };
    }

    // Determinar saúde geral das métricas
    const healthyMetrics = Object.values(metricsCheck.results)
        .filter(result => result.isHealthy !== false).length;
    const totalMetrics = Object.keys(metricsCheck.results).length;
    
    metricsCheck.isHealthy = healthyMetrics / totalMetrics >= 0.5;

    return metricsCheck;
}

/**
 * Detectar anomalias
 */
function detectAnomalies(currentCheck, previousChecks) {
    const anomalies = [];

    if (previousChecks.length < 3) {
        return anomalies; // Não há dados suficientes
    }

    // Anomalia 1: Degradação súbita de performance
    if (currentCheck.type === 'api_health') {
        const currentAvgResponseTime = Object.values(currentCheck.results)
            .filter(r => r.responseTime)
            .reduce((sum, r) => sum + r.responseTime, 0) / 
            Object.values(currentCheck.results).filter(r => r.responseTime).length;

        const previousAvgResponseTimes = previousChecks
            .filter(check => check.type === 'api_health')
            .slice(-3)
            .map(check => {
                const times = Object.values(check.results)
                    .filter(r => r.responseTime)
                    .map(r => r.responseTime);
                return times.reduce((sum, time) => sum + time, 0) / times.length;
            });

        if (previousAvgResponseTimes.length > 0) {
            const avgPreviousTime = previousAvgResponseTimes.reduce((sum, time) => sum + time, 0) / previousAvgResponseTimes.length;
            
            if (currentAvgResponseTime > avgPreviousTime * 2) {
                anomalies.push({
                    type: 'performance_degradation',
                    severity: 'high',
                    message: `Tempo de resposta aumentou significativamente: ${Math.round(currentAvgResponseTime)}ms vs ${Math.round(avgPreviousTime)}ms média anterior`,
                    currentValue: currentAvgResponseTime,
                    previousValue: avgPreviousTime
                });
            }
        }
    }

    // Anomalia 2: Queda súbita na conversão
    if (currentCheck.type === 'business_metrics' && currentCheck.results.checkout) {
        const currentConversion = currentCheck.results.checkout.conversionRate;
        
        const previousConversions = previousChecks
            .filter(check => check.type === 'business_metrics' && check.results.checkout)
            .slice(-3)
            .map(check => check.results.checkout.conversionRate);

        if (previousConversions.length > 0) {
            const avgPreviousConversion = previousConversions.reduce((sum, rate) => sum + rate, 0) / previousConversions.length;
            
            if (currentConversion < avgPreviousConversion * 0.7) {
                anomalies.push({
                    type: 'conversion_drop',
                    severity: 'critical',
                    message: `Taxa de conversão caiu drasticamente: ${currentConversion}% vs ${Math.round(avgPreviousConversion)}% média anterior`,
                    currentValue: currentConversion,
                    previousValue: avgPreviousConversion
                });
            }
        }
    }

    return anomalies;
}

/**
 * Gerar alerta
 */
function generateAlert(type, severity, message, data = {}) {
    const alert = {
        timestamp: new Date(),
        type: type,
        severity: severity,
        message: message,
        data: data,
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    monitoringState.alerts.push(alert);

    // Log do alerta
    const severityEmoji = {
        low: '🟡',
        medium: '🟠', 
        high: '🔴',
        critical: '🚨'
    };

    console.log(`\n${severityEmoji[severity]} ALERTA ${severity.toUpperCase()}: ${message}`);
    
    if (Object.keys(data).length > 0) {
        console.log(`   Dados: ${JSON.stringify(data, null, 2)}`);
    }

    // Enviar notificação (implementar conforme necessário)
    sendNotification(alert);

    return alert;
}

/**
 * Enviar notificação
 */
async function sendNotification(alert) {
    // Implementar integração com Slack, email, etc.
    
    if (process.env.SLACK_WEBHOOK_URL) {
        try {
            const slackMessage = {
                text: `🚨 Alerta de Deploy - ${alert.severity.toUpperCase()}`,
                attachments: [{
                    color: alert.severity === 'critical' ? 'danger' : 'warning',
                    fields: [{
                        title: 'Mensagem',
                        value: alert.message,
                        short: false
                    }, {
                        title: 'Timestamp',
                        value: alert.timestamp.toISOString(),
                        short: true
                    }, {
                        title: 'Tipo',
                        value: alert.type,
                        short: true
                    }]
                }]
            };

            await fetch(process.env.SLACK_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(slackMessage)
            });

        } catch (error) {
            console.log(`   ⚠️  Erro ao enviar notificação Slack: ${error.message}`);
        }
    }
}

/**
 * Executar ciclo de monitoramento
 */
async function runMonitoringCycle() {
    console.log(`🔍 Executando verificação - ${new Date().toLocaleTimeString()}`);

    try {
        // Verificar saúde da API
        const apiHealthCheck = await checkApiHealth();
        monitoringState.checks.push(apiHealthCheck);

        // Verificar métricas de negócio
        const businessMetricsCheck = await checkBusinessMetrics();
        monitoringState.checks.push(businessMetricsCheck);

        // Detectar anomalias
        const anomalies = detectAnomalies(apiHealthCheck, monitoringState.checks);
        anomalies.forEach(anomaly => {
            generateAlert(anomaly.type, anomaly.severity, anomaly.message, {
                currentValue: anomaly.currentValue,
                previousValue: anomaly.previousValue
            });
        });

        // Verificar se sistema está saudável
        const isCurrentlyHealthy = apiHealthCheck.isHealthy && businessMetricsCheck.isHealthy;

        if (!isCurrentlyHealthy) {
            monitoringState.consecutiveFailures++;
            
            if (monitoringState.consecutiveFailures >= monitoringConfig.maxConsecutiveFailures) {
                generateAlert(
                    'system_unhealthy',
                    'critical',
                    `Sistema não saudável por ${monitoringState.consecutiveFailures} verificações consecutivas`,
                    {
                        consecutiveFailures: monitoringState.consecutiveFailures,
                        apiHealth: apiHealthCheck.overallHealth,
                        businessMetricsHealthy: businessMetricsCheck.isHealthy
                    }
                );
            }
        } else {
            monitoringState.consecutiveFailures = 0;
        }

        monitoringState.isHealthy = isCurrentlyHealthy;

        // Log resumido
        const apiHealthPercent = Math.round(apiHealthCheck.overallHealth * 100);
        const checkoutMetrics = businessMetricsCheck.results.checkout;
        const webhookMetrics = businessMetricsCheck.results.webhooks;

        console.log(`   API: ${apiHealthPercent}% saudável`);
        
        if (checkoutMetrics && checkoutMetrics.status === 'healthy') {
            console.log(`   Checkout: ${checkoutMetrics.total} total, ${checkoutMetrics.conversionRate}% conversão`);
        }
        
        if (webhookMetrics && webhookMetrics.status === 'healthy') {
            console.log(`   Webhooks: ${webhookMetrics.total} total, ${webhookMetrics.successRate}% sucesso`);
        }

        // Limitar histórico de checks (manter últimos 100)
        if (monitoringState.checks.length > 100) {
            monitoringState.checks = monitoringState.checks.slice(-100);
        }

    } catch (error) {
        console.error(`   ❌ Erro durante monitoramento: ${error.message}`);
        
        generateAlert(
            'monitoring_error',
            'high',
            `Erro durante execução do monitoramento: ${error.message}`,
            { error: error.stack }
        );
    }
}

/**
 * Gerar relatório final
 */
function generateFinalReport() {
    const endTime = new Date();
    const duration = endTime - monitoringState.startTime;
    
    const report = {
        summary: {
            startTime: monitoringState.startTime,
            endTime: endTime,
            duration: Math.round(duration / 1000),
            totalChecks: monitoringState.checks.length,
            totalAlerts: monitoringState.alerts.length,
            finalHealthStatus: monitoringState.isHealthy ? 'healthy' : 'unhealthy'
        },
        alerts: monitoringState.alerts,
        healthTrend: monitoringState.checks.map(check => ({
            timestamp: check.timestamp,
            type: check.type,
            isHealthy: check.isHealthy
        })),
        metrics: {
            apiHealthChecks: monitoringState.checks.filter(c => c.type === 'api_health').length,
            businessMetricChecks: monitoringState.checks.filter(c => c.type === 'business_metrics').length,
            criticalAlerts: monitoringState.alerts.filter(a => a.severity === 'critical').length,
            highAlerts: monitoringState.alerts.filter(a => a.severity === 'high').length
        }
    };

    // Salvar relatório
    const reportPath = path.join(__dirname, '..', `post-deploy-monitoring-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return { report, reportPath };
}

/**
 * Função principal
 */
async function main() {
    console.log('📊 Iniciando monitoramento pós-deploy...\n');
    console.log(`🌍 URL da aplicação: ${appUrl}`);
    console.log(`⏱️  Duração: ${monitoringConfig.monitoringDuration / 1000 / 60} minutos`);
    console.log(`🔄 Intervalo: ${monitoringConfig.checkInterval / 1000} segundos\n`);

    const args = process.argv.slice(2);
    const duration = args.includes('--duration') ? 
        parseInt(args[args.indexOf('--duration') + 1]) * 60 * 1000 : 
        monitoringConfig.monitoringDuration;

    const interval = args.includes('--interval') ? 
        parseInt(args[args.indexOf('--interval') + 1]) * 1000 : 
        monitoringConfig.checkInterval;

    console.log('🎯 Thresholds de alerta:');
    console.log(`   Taxa de erro: ${monitoringConfig.alertThresholds.errorRate}%`);
    console.log(`   Tempo de resposta: ${monitoringConfig.alertThresholds.responseTime}ms`);
    console.log(`   Taxa de conversão mínima: ${monitoringConfig.alertThresholds.conversionRate}%`);
    console.log(`   Taxa de falha de webhook: ${monitoringConfig.alertThresholds.webhookFailureRate}%\n`);

    // Executar primeira verificação
    await runMonitoringCycle();

    // Configurar monitoramento contínuo
    const monitoringInterval = setInterval(runMonitoringCycle, interval);

    // Parar monitoramento após duração especificada
    setTimeout(() => {
        clearInterval(monitoringInterval);
        
        console.log('\n⏰ Monitoramento concluído\n');
        
        const { report, reportPath } = generateFinalReport();
        
        console.log('📋 RELATÓRIO FINAL');
        console.log('=' .repeat(40));
        console.log(`⏱️  Duração: ${report.summary.duration}s`);
        console.log(`🔍 Total de verificações: ${report.summary.totalChecks}`);
        console.log(`🚨 Total de alertas: ${report.summary.totalAlerts}`);
        console.log(`🏥 Status final: ${report.summary.finalHealthStatus}`);
        
        if (report.summary.totalAlerts > 0) {
            console.log('\n🚨 Alertas gerados:');
            report.alerts.forEach(alert => {
                console.log(`   ${alert.severity.toUpperCase()}: ${alert.message}`);
            });
        }

        console.log(`\n📄 Relatório completo: ${reportPath}`);

        // Recomendações
        if (report.summary.finalHealthStatus === 'healthy' && report.summary.totalAlerts === 0) {
            console.log('\n✅ Deploy validado com sucesso!');
            console.log('   Sistema está operando normalmente');
        } else if (report.summary.finalHealthStatus === 'healthy' && report.summary.totalAlerts > 0) {
            console.log('\n⚠️  Deploy com avisos');
            console.log('   Sistema saudável mas com alertas durante monitoramento');
            console.log('   Recomenda-se investigar os alertas gerados');
        } else {
            console.log('\n❌ Deploy com problemas');
            console.log('   Sistema não está saudável');
            console.log('   Considere rollback ou correção imediata');
        }

        process.exit(report.summary.finalHealthStatus === 'healthy' ? 0 : 1);
        
    }, duration);

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Interrompendo monitoramento...');
        clearInterval(monitoringInterval);
        
        const { report, reportPath } = generateFinalReport();
        console.log(`📄 Relatório parcial salvo: ${reportPath}`);
        
        process.exit(0);
    });
}

// Executar se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = {
    checkApiHealth,
    checkBusinessMetrics,
    detectAnomalies,
    generateAlert,
    runMonitoringCycle
};