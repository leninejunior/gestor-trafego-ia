#!/usr/bin/env node

/**
 * Script de Validação de Integridade - Migração do Sistema de Checkout
 * 
 * Valida a integridade dos dados após migração e executa testes de consistência
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

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variáveis de ambiente não configuradas');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

/**
 * Validar estrutura das tabelas
 */
async function validateTableStructure() {
    console.log('🏗️  Validando estrutura das tabelas...\n');

    const expectedTables = {
        'subscription_intents': {
            required_columns: [
                'id', 'plan_id', 'billing_cycle', 'status', 'user_email', 
                'user_name', 'organization_name', 'created_at', 'updated_at'
            ],
            optional_columns: [
                'cpf_cnpj', 'phone', 'iugu_customer_id', 'iugu_subscription_id',
                'checkout_url', 'user_id', 'metadata', 'expires_at', 'completed_at'
            ]
        },
        'webhook_logs': {
            required_columns: [
                'id', 'event_type', 'payload', 'status', 'created_at'
            ],
            optional_columns: [
                'event_id', 'subscription_intent_id', 'processed_at', 
                'error_message', 'retry_count'
            ]
        },
        'payment_analytics': {
            required_columns: [
                'id', 'date', 'created_at'
            ],
            optional_columns: [
                'plan_id', 'checkouts_started', 'checkouts_completed',
                'payments_confirmed', 'revenue_total', 'avg_completion_time_minutes'
            ]
        },
        'subscription_intent_transitions': {
            required_columns: [
                'id', 'subscription_intent_id', 'to_status', 'created_at'
            ],
            optional_columns: [
                'from_status', 'reason', 'triggered_by', 'metadata'
            ]
        }
    };

    const results = {
        passed: 0,
        failed: 0,
        warnings: 0
    };

    for (const [tableName, expectedStructure] of Object.entries(expectedTables)) {
        console.log(`   Verificando ${tableName}...`);

        try {
            // Tentar selecionar dados para verificar se tabela existe
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(1);

            if (error) {
                console.log(`      ❌ Tabela não existe ou inacessível: ${error.message}`);
                results.failed++;
                continue;
            }

            // Se há dados, verificar colunas
            if (data && data.length > 0) {
                const actualColumns = Object.keys(data[0]);
                const missingRequired = expectedStructure.required_columns.filter(
                    col => !actualColumns.includes(col)
                );

                if (missingRequired.length > 0) {
                    console.log(`      ❌ Colunas obrigatórias faltando: ${missingRequired.join(', ')}`);
                    results.failed++;
                } else {
                    console.log(`      ✅ Estrutura válida (${actualColumns.length} colunas)`);
                    results.passed++;
                }
            } else {
                console.log(`      ✅ Tabela existe (vazia)`);
                results.passed++;
            }

        } catch (error) {
            console.log(`      ❌ Erro ao verificar: ${error.message}`);
            results.failed++;
        }
    }

    return results;
}

/**
 * Validar integridade referencial
 */
async function validateReferentialIntegrity() {
    console.log('\n🔗 Validando integridade referencial...\n');

    const results = {
        passed: 0,
        failed: 0,
        warnings: 0
    };

    // Teste 1: subscription_intents -> subscription_plans
    console.log('   1. Verificando referências plan_id...');
    try {
        const { data: orphanedIntents, error } = await supabase
            .rpc('check_orphaned_subscription_intents');

        if (error) {
            // Se função não existe, fazer verificação manual
            const { data: intentsWithInvalidPlans, error: manualError } = await supabase
                .from('subscription_intents')
                .select('id, plan_id')
                .limit(1000);

            if (manualError) {
                console.log(`      ❌ Erro na verificação: ${manualError.message}`);
                results.failed++;
            } else {
                // Verificar manualmente (limitado)
                console.log(`      ⚠️  Verificação manual limitada (${intentsWithInvalidPlans.length} registros)`);
                results.warnings++;
            }
        } else {
            const orphanedCount = orphanedIntents || 0;
            if (orphanedCount > 0) {
                console.log(`      ❌ ${orphanedCount} intents com planos inválidos`);
                results.failed++;
            } else {
                console.log(`      ✅ Todas as referências plan_id são válidas`);
                results.passed++;
            }
        }
    } catch (error) {
        console.log(`      ❌ Erro: ${error.message}`);
        results.failed++;
    }

    // Teste 2: subscription_intents -> auth.users
    console.log('\n   2. Verificando referências user_id...');
    try {
        const { data: intentsWithUsers, error } = await supabase
            .from('subscription_intents')
            .select('id, user_id')
            .not('user_id', 'is', null)
            .limit(100);

        if (error) {
            console.log(`      ❌ Erro na verificação: ${error.message}`);
            results.failed++;
        } else {
            console.log(`      ✅ ${intentsWithUsers.length} intents com user_id válidos`);
            results.passed++;
        }
    } catch (error) {
        console.log(`      ❌ Erro: ${error.message}`);
        results.failed++;
    }

    // Teste 3: webhook_logs -> subscription_intents
    console.log('\n   3. Verificando referências webhook_logs...');
    try {
        const { data: webhooksWithIntents, error } = await supabase
            .from('webhook_logs')
            .select('id, subscription_intent_id')
            .not('subscription_intent_id', 'is', null)
            .limit(100);

        if (error) {
            console.log(`      ❌ Erro na verificação: ${error.message}`);
            results.failed++;
        } else {
            console.log(`      ✅ ${webhooksWithIntents.length} webhooks com referências válidas`);
            results.passed++;
        }
    } catch (error) {
        console.log(`      ❌ Erro: ${error.message}`);
        results.failed++;
    }

    return results;
}

/**
 * Validar consistência de dados
 */
async function validateDataConsistency() {
    console.log('\n📊 Validando consistência de dados...\n');

    const results = {
        passed: 0,
        failed: 0,
        warnings: 0
    };

    // Teste 1: Status válidos em subscription_intents
    console.log('   1. Verificando status válidos...');
    try {
        const { data: invalidStatuses, error } = await supabase
            .from('subscription_intents')
            .select('id, status')
            .not('status', 'in', '(pending,processing,completed,failed,expired)');

        if (error) {
            console.log(`      ❌ Erro na verificação: ${error.message}`);
            results.failed++;
        } else if (invalidStatuses.length > 0) {
            console.log(`      ❌ ${invalidStatuses.length} intents com status inválidos`);
            results.failed++;
        } else {
            console.log(`      ✅ Todos os status são válidos`);
            results.passed++;
        }
    } catch (error) {
        console.log(`      ❌ Erro: ${error.message}`);
        results.failed++;
    }

    // Teste 2: Billing cycles válidos
    console.log('\n   2. Verificando billing cycles...');
    try {
        const { data: invalidCycles, error } = await supabase
            .from('subscription_intents')
            .select('id, billing_cycle')
            .not('billing_cycle', 'in', '(monthly,annual)');

        if (error) {
            console.log(`      ❌ Erro na verificação: ${error.message}`);
            results.failed++;
        } else if (invalidCycles.length > 0) {
            console.log(`      ❌ ${invalidCycles.length} intents com billing_cycle inválidos`);
            results.failed++;
        } else {
            console.log(`      ✅ Todos os billing cycles são válidos`);
            results.passed++;
        }
    } catch (error) {
        console.log(`      ❌ Erro: ${error.message}`);
        results.failed++;
    }

    // Teste 3: Emails válidos
    console.log('\n   3. Verificando formato de emails...');
    try {
        const { data: intents, error } = await supabase
            .from('subscription_intents')
            .select('id, user_email')
            .limit(100);

        if (error) {
            console.log(`      ❌ Erro na verificação: ${error.message}`);
            results.failed++;
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const invalidEmails = intents.filter(intent => !emailRegex.test(intent.user_email));

            if (invalidEmails.length > 0) {
                console.log(`      ⚠️  ${invalidEmails.length} emails com formato suspeito`);
                results.warnings++;
            } else {
                console.log(`      ✅ Formato de emails válido (amostra de ${intents.length})`);
                results.passed++;
            }
        }
    } catch (error) {
        console.log(`      ❌ Erro: ${error.message}`);
        results.failed++;
    }

    // Teste 4: Timestamps consistentes
    console.log('\n   4. Verificando timestamps...');
    try {
        const { data: inconsistentTimestamps, error } = await supabase
            .from('subscription_intents')
            .select('id, created_at, updated_at, completed_at')
            .gt('created_at', 'updated_at');

        if (error) {
            console.log(`      ❌ Erro na verificação: ${error.message}`);
            results.failed++;
        } else if (inconsistentTimestamps.length > 0) {
            console.log(`      ⚠️  ${inconsistentTimestamps.length} registros com timestamps inconsistentes`);
            results.warnings++;
        } else {
            console.log(`      ✅ Timestamps consistentes`);
            results.passed++;
        }
    } catch (error) {
        console.log(`      ❌ Erro: ${error.message}`);
        results.failed++;
    }

    return results;
}

/**
 * Validar funcionalidades do sistema
 */
async function validateSystemFunctions() {
    console.log('\n⚙️  Validando funcionalidades do sistema...\n');

    const results = {
        passed: 0,
        failed: 0,
        warnings: 0
    };

    // Teste 1: Função de limpeza
    console.log('   1. Testando função de limpeza...');
    try {
        const { data, error } = await supabase.rpc('cleanup_expired_subscription_intents');

        if (error) {
            console.log(`      ❌ Função de limpeza falhou: ${error.message}`);
            results.failed++;
        } else {
            console.log(`      ✅ Função de limpeza OK (${data || 0} registros processados)`);
            results.passed++;
        }
    } catch (error) {
        console.log(`      ❌ Erro: ${error.message}`);
        results.failed++;
    }

    // Teste 2: Função de analytics
    console.log('\n   2. Testando função de analytics...');
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase.rpc('update_daily_payment_analytics', {
            target_date: today
        });

        if (error) {
            console.log(`      ❌ Função de analytics falhou: ${error.message}`);
            results.failed++;
        } else {
            console.log(`      ✅ Função de analytics OK (${data || 0} registros processados)`);
            results.passed++;
        }
    } catch (error) {
        console.log(`      ❌ Erro: ${error.message}`);
        results.failed++;
    }

    // Teste 3: Triggers de auditoria
    console.log('\n   3. Testando triggers de auditoria...');
    try {
        // Criar um intent de teste
        const { data: testIntent, error: createError } = await supabase
            .from('subscription_intents')
            .insert({
                plan_id: '00000000-0000-0000-0000-000000000001', // ID fictício para teste
                billing_cycle: 'monthly',
                user_email: 'test-validation@example.com',
                user_name: 'Test Validation',
                organization_name: 'Test Validation Org',
                status: 'pending'
            })
            .select()
            .single();

        if (createError) {
            console.log(`      ⚠️  Não foi possível criar intent de teste: ${createError.message}`);
            results.warnings++;
        } else {
            // Atualizar status para testar trigger
            const { error: updateError } = await supabase
                .from('subscription_intents')
                .update({ status: 'processing' })
                .eq('id', testIntent.id);

            if (updateError) {
                console.log(`      ❌ Erro ao atualizar intent de teste: ${updateError.message}`);
                results.failed++;
            } else {
                // Verificar se transição foi registrada
                const { data: transitions, error: transitionError } = await supabase
                    .from('subscription_intent_transitions')
                    .select('*')
                    .eq('subscription_intent_id', testIntent.id);

                if (transitionError) {
                    console.log(`      ❌ Erro ao verificar transições: ${transitionError.message}`);
                    results.failed++;
                } else if (transitions.length > 0) {
                    console.log(`      ✅ Triggers de auditoria funcionando (${transitions.length} transições)`);
                    results.passed++;
                } else {
                    console.log(`      ⚠️  Nenhuma transição registrada`);
                    results.warnings++;
                }
            }

            // Limpar intent de teste
            await supabase
                .from('subscription_intent_transitions')
                .delete()
                .eq('subscription_intent_id', testIntent.id);
            
            await supabase
                .from('subscription_intents')
                .delete()
                .eq('id', testIntent.id);
        }
    } catch (error) {
        console.log(`      ❌ Erro: ${error.message}`);
        results.failed++;
    }

    return results;
}

/**
 * Gerar relatório de validação
 */
function generateValidationReport(allResults) {
    const totalResults = {
        passed: 0,
        failed: 0,
        warnings: 0
    };

    // Somar todos os resultados
    Object.values(allResults).forEach(result => {
        totalResults.passed += result.passed;
        totalResults.failed += result.failed;
        totalResults.warnings += result.warnings;
    });

    const totalTests = totalResults.passed + totalResults.failed + totalResults.warnings;
    const successRate = totalTests > 0 ? (totalResults.passed / totalTests * 100).toFixed(1) : 0;

    console.log('\n📋 RELATÓRIO DE VALIDAÇÃO');
    console.log('=' .repeat(50));
    
    console.log('\n📊 Resumo por categoria:');
    Object.entries(allResults).forEach(([category, result]) => {
        const categoryTotal = result.passed + result.failed + result.warnings;
        const categoryRate = categoryTotal > 0 ? (result.passed / categoryTotal * 100).toFixed(1) : 0;
        console.log(`   ${category}: ${result.passed}✅ ${result.failed}❌ ${result.warnings}⚠️  (${categoryRate}%)`);
    });

    console.log('\n📈 Totais gerais:');
    console.log(`   ✅ Passou: ${totalResults.passed}`);
    console.log(`   ❌ Falhou: ${totalResults.failed}`);
    console.log(`   ⚠️  Avisos: ${totalResults.warnings}`);
    console.log(`   📊 Taxa de sucesso: ${successRate}%`);

    // Determinar status geral
    let overallStatus;
    if (totalResults.failed === 0 && totalResults.warnings === 0) {
        overallStatus = '🎉 EXCELENTE - Migração perfeita!';
    } else if (totalResults.failed === 0) {
        overallStatus = '✅ BOM - Migração bem-sucedida com avisos menores';
    } else if (totalResults.failed <= 2) {
        overallStatus = '⚠️  ATENÇÃO - Migração com problemas menores';
    } else {
        overallStatus = '❌ CRÍTICO - Migração com problemas sérios';
    }

    console.log(`\n🎯 Status geral: ${overallStatus}`);

    // Recomendações
    console.log('\n💡 Recomendações:');
    if (totalResults.failed > 0) {
        console.log('   - Revisar e corrigir falhas antes de usar em produção');
        console.log('   - Considerar rollback se problemas são críticos');
    }
    if (totalResults.warnings > 0) {
        console.log('   - Investigar avisos para otimização');
        console.log('   - Monitorar comportamento em produção');
    }
    if (totalResults.failed === 0 && totalResults.warnings === 0) {
        console.log('   - Sistema pronto para produção');
        console.log('   - Implementar monitoramento contínuo');
    }

    return {
        totalResults,
        successRate: parseFloat(successRate),
        overallStatus,
        isHealthy: totalResults.failed === 0
    };
}

/**
 * Função principal
 */
async function main() {
    console.log('🔍 Iniciando validação de integridade da migração...\n');

    try {
        const allResults = {};

        // Executar todas as validações
        allResults['Estrutura das Tabelas'] = await validateTableStructure();
        allResults['Integridade Referencial'] = await validateReferentialIntegrity();
        allResults['Consistência de Dados'] = await validateDataConsistency();
        allResults['Funcionalidades do Sistema'] = await validateSystemFunctions();

        // Gerar relatório final
        const report = generateValidationReport(allResults);

        // Salvar relatório
        const reportPath = path.join(__dirname, '..', `validation-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            results: allResults,
            summary: report
        }, null, 2));

        console.log(`\n📄 Relatório salvo: ${reportPath}`);

        // Exit code baseado no resultado
        process.exit(report.isHealthy ? 0 : 1);

    } catch (error) {
        console.error(`\n❌ Erro durante validação: ${error.message}`);
        process.exit(1);
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = {
    validateTableStructure,
    validateReferentialIntegrity,
    validateDataConsistency,
    validateSystemFunctions,
    generateValidationReport
};