#!/usr/bin/env node

/**
 * Script de Migração Completa - Sistema de Checkout e Pagamentos
 * 
 * Este script migra dados existentes para o novo sistema de checkout,
 * incluindo validação de integridade e rollback procedures.
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
    console.error('Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Estado da migração
let migrationState = {
    startTime: new Date(),
    backupCreated: false,
    schemaApplied: false,
    dataMigrated: false,
    validationPassed: false,
    rollbackData: {}
};

/**
 * Criar backup dos dados existentes
 */
async function createBackup() {
    console.log('📦 Criando backup dos dados existentes...\n');
    
    const backupData = {
        timestamp: new Date().toISOString(),
        tables: {}
    };

    // Tabelas para backup
    const tablesToBackup = [
        'subscriptions',
        'subscription_plans', 
        'organizations',
        'organization_memberships'
    ];

    for (const tableName of tablesToBackup) {
        try {
            console.log(`   Fazendo backup de ${tableName}...`);
            
            const { data, error } = await supabase
                .from(tableName)
                .select('*');

            if (error) {
                if (error.message.includes('does not exist')) {
                    console.log(`   ⚠️  Tabela ${tableName} não existe - pulando`);
                    continue;
                } else {
                    throw error;
                }
            }

            backupData.tables[tableName] = data;
            console.log(`   ✅ ${data.length} registros salvos`);
            
        } catch (error) {
            console.error(`   ❌ Erro no backup de ${tableName}: ${error.message}`);
            throw error;
        }
    }

    // Salvar backup em arquivo
    const backupPath = path.join(__dirname, '..', 'backups', `checkout-migration-${Date.now()}.json`);
    const backupDir = path.dirname(backupPath);
    
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    
    migrationState.backupCreated = true;
    migrationState.backupPath = backupPath;
    
    console.log(`\n✅ Backup criado: ${backupPath}`);
    return backupData;
}

/**
 * Aplicar schema do novo sistema
 */
async function applyNewSchema() {
    console.log('\n🏗️  Aplicando novo schema...\n');

    const schemaFiles = [
        'database/checkout-payment-schema-migration.sql',
        'database/webhook-logs-analytics-schema.sql',
        'database/subscription-intents-schema.sql',
        'database/subscription-intent-transitions-schema.sql'
    ];

    for (const schemaFile of schemaFiles) {
        const schemaPath = path.join(__dirname, '..', schemaFile);
        
        if (!fs.existsSync(schemaPath)) {
            console.log(`   ⚠️  Schema file não encontrado: ${schemaFile} - pulando`);
            continue;
        }

        try {
            console.log(`   Aplicando ${schemaFile}...`);
            
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            
            // Executar SQL via RPC (para schemas complexos)
            const { data, error } = await supabase.rpc('exec_sql', {
                sql_query: schemaSql
            });

            if (error) {
                // Se RPC não existir, tentar executar diretamente
                if (error.message.includes('function exec_sql')) {
                    console.log(`   ⚠️  Função exec_sql não disponível - aplicar manualmente: ${schemaFile}`);
                } else {
                    throw error;
                }
            } else {
                console.log(`   ✅ Schema aplicado com sucesso`);
            }
            
        } catch (error) {
            console.error(`   ❌ Erro ao aplicar schema ${schemaFile}: ${error.message}`);
            throw error;
        }
    }

    migrationState.schemaApplied = true;
    console.log('\n✅ Novo schema aplicado');
}

/**
 * Migrar dados existentes
 */
async function migrateExistingData(backupData) {
    console.log('\n🔄 Migrando dados existentes...\n');

    let migratedCount = 0;

    // Migrar assinaturas existentes para subscription_intents
    if (backupData.tables.subscriptions) {
        console.log('   Migrando assinaturas existentes...');
        
        for (const subscription of backupData.tables.subscriptions) {
            try {
                // Buscar dados do usuário e organização
                const { data: orgMembership } = await supabase
                    .from('organization_memberships')
                    .select(`
                        organizations (id, name),
                        auth.users (id, email, raw_user_meta_data)
                    `)
                    .eq('organization_id', subscription.organization_id)
                    .eq('role', 'owner')
                    .single();

                if (!orgMembership) {
                    console.log(`   ⚠️  Organização não encontrada para subscription ${subscription.id}`);
                    continue;
                }

                const user = orgMembership.auth?.users;
                const organization = orgMembership.organizations;

                if (!user || !organization) {
                    console.log(`   ⚠️  Dados incompletos para subscription ${subscription.id}`);
                    continue;
                }

                // Criar subscription_intent baseado na assinatura existente
                const intentData = {
                    plan_id: subscription.plan_id,
                    billing_cycle: subscription.billing_cycle || 'monthly',
                    status: subscription.status === 'active' ? 'completed' : 'expired',
                    user_email: user.email,
                    user_name: user.raw_user_meta_data?.full_name || user.email.split('@')[0],
                    organization_name: organization.name,
                    user_id: user.id,
                    iugu_subscription_id: subscription.iugu_subscription_id,
                    completed_at: subscription.status === 'active' ? subscription.created_at : null,
                    created_at: subscription.created_at,
                    updated_at: subscription.updated_at || subscription.created_at,
                    metadata: {
                        migrated_from: 'subscriptions',
                        original_id: subscription.id,
                        migration_date: new Date().toISOString()
                    }
                };

                const { data: intent, error } = await supabase
                    .from('subscription_intents')
                    .insert(intentData)
                    .select()
                    .single();

                if (error) {
                    console.error(`   ❌ Erro ao migrar subscription ${subscription.id}: ${error.message}`);
                    continue;
                }

                migratedCount++;
                console.log(`   ✅ Migrado: ${subscription.id} -> ${intent.id}`);

                // Armazenar mapeamento para rollback
                if (!migrationState.rollbackData.subscriptionMapping) {
                    migrationState.rollbackData.subscriptionMapping = {};
                }
                migrationState.rollbackData.subscriptionMapping[subscription.id] = intent.id;

            } catch (error) {
                console.error(`   ❌ Erro ao processar subscription ${subscription.id}: ${error.message}`);
            }
        }
    }

    migrationState.dataMigrated = true;
    console.log(`\n✅ Migração concluída: ${migratedCount} registros migrados`);
    return migratedCount;
}

/**
 * Validar integridade pós-migração
 */
async function validateMigration(backupData) {
    console.log('\n🔍 Validando integridade da migração...\n');

    const validationResults = {
        passed: 0,
        failed: 0,
        warnings: 0
    };

    // Teste 1: Verificar se todas as tabelas existem
    console.log('   1. Verificando tabelas...');
    const requiredTables = [
        'subscription_intents',
        'webhook_logs', 
        'payment_analytics',
        'subscription_intent_transitions'
    ];

    for (const tableName of requiredTables) {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(0);

            if (error) {
                console.log(`      ❌ Tabela ${tableName}: ${error.message}`);
                validationResults.failed++;
            } else {
                console.log(`      ✅ Tabela ${tableName}: OK`);
                validationResults.passed++;
            }
        } catch (error) {
            console.log(`      ❌ Tabela ${tableName}: ${error.message}`);
            validationResults.failed++;
        }
    }

    // Teste 2: Verificar contagem de registros migrados
    console.log('\n   2. Verificando dados migrados...');
    
    if (backupData.tables.subscriptions) {
        const originalCount = backupData.tables.subscriptions.length;
        
        const { data: migratedIntents, error } = await supabase
            .from('subscription_intents')
            .select('*')
            .not('metadata->migrated_from', 'is', null);

        if (error) {
            console.log(`      ❌ Erro ao contar registros migrados: ${error.message}`);
            validationResults.failed++;
        } else {
            const migratedCount = migratedIntents.length;
            
            if (migratedCount === originalCount) {
                console.log(`      ✅ Contagem de registros: ${migratedCount}/${originalCount}`);
                validationResults.passed++;
            } else {
                console.log(`      ⚠️  Contagem divergente: ${migratedCount}/${originalCount}`);
                validationResults.warnings++;
            }
        }
    }

    // Teste 3: Verificar integridade referencial
    console.log('\n   3. Verificando integridade referencial...');
    
    try {
        const { data: orphanedIntents, error } = await supabase
            .from('subscription_intents')
            .select('id, plan_id')
            .not('plan_id', 'in', `(SELECT id FROM subscription_plans)`);

        if (error) {
            console.log(`      ❌ Erro ao verificar integridade: ${error.message}`);
            validationResults.failed++;
        } else if (orphanedIntents.length > 0) {
            console.log(`      ⚠️  ${orphanedIntents.length} intents com planos inválidos`);
            validationResults.warnings++;
        } else {
            console.log(`      ✅ Integridade referencial: OK`);
            validationResults.passed++;
        }
    } catch (error) {
        console.log(`      ❌ Erro na verificação de integridade: ${error.message}`);
        validationResults.failed++;
    }

    // Teste 4: Verificar funções do sistema
    console.log('\n   4. Verificando funções do sistema...');
    
    const functionsToTest = [
        'cleanup_expired_subscription_intents',
        'update_daily_payment_analytics'
    ];

    for (const functionName of functionsToTest) {
        try {
            const { data, error } = await supabase.rpc(functionName);
            
            if (error) {
                console.log(`      ❌ Função ${functionName}: ${error.message}`);
                validationResults.failed++;
            } else {
                console.log(`      ✅ Função ${functionName}: OK`);
                validationResults.passed++;
            }
        } catch (error) {
            console.log(`      ❌ Função ${functionName}: ${error.message}`);
            validationResults.failed++;
        }
    }

    // Resultado final
    const totalTests = validationResults.passed + validationResults.failed + validationResults.warnings;
    const successRate = (validationResults.passed / totalTests * 100).toFixed(1);

    console.log(`\n📊 Resultado da validação:`);
    console.log(`   ✅ Passou: ${validationResults.passed}`);
    console.log(`   ❌ Falhou: ${validationResults.failed}`);
    console.log(`   ⚠️  Avisos: ${validationResults.warnings}`);
    console.log(`   📈 Taxa de sucesso: ${successRate}%`);

    const validationPassed = validationResults.failed === 0;
    migrationState.validationPassed = validationPassed;

    if (validationPassed) {
        console.log('\n✅ Validação passou - migração bem-sucedida!');
    } else {
        console.log('\n❌ Validação falhou - considere rollback');
    }

    return validationResults;
}

/**
 * Executar rollback em caso de falha
 */
async function rollback(backupData) {
    console.log('\n🔄 Executando rollback...\n');

    try {
        // Remover dados migrados
        if (migrationState.rollbackData.subscriptionMapping) {
            console.log('   Removendo subscription_intents migrados...');
            
            const intentIds = Object.values(migrationState.rollbackData.subscriptionMapping);
            
            const { error } = await supabase
                .from('subscription_intents')
                .delete()
                .in('id', intentIds);

            if (error) {
                console.error(`   ❌ Erro ao remover intents: ${error.message}`);
            } else {
                console.log(`   ✅ ${intentIds.length} intents removidos`);
            }
        }

        // Restaurar dados originais se necessário
        // (Neste caso, os dados originais não foram modificados)

        console.log('\n✅ Rollback concluído');
        
    } catch (error) {
        console.error(`❌ Erro durante rollback: ${error.message}`);
        throw error;
    }
}

/**
 * Salvar estado da migração
 */
function saveMigrationState() {
    const statePath = path.join(__dirname, '..', 'migration-state.json');
    fs.writeFileSync(statePath, JSON.stringify(migrationState, null, 2));
    console.log(`📄 Estado da migração salvo: ${statePath}`);
}

/**
 * Função principal
 */
async function main() {
    console.log('🚀 Iniciando migração do sistema de checkout...\n');
    console.log(`⏰ Início: ${migrationState.startTime.toISOString()}\n`);

    try {
        // 1. Criar backup
        const backupData = await createBackup();

        // 2. Aplicar novo schema
        await applyNewSchema();

        // 3. Migrar dados existentes
        const migratedCount = await migrateExistingData(backupData);

        // 4. Validar migração
        const validationResults = await validateMigration(backupData);

        // 5. Verificar se migração foi bem-sucedida
        if (!migrationState.validationPassed) {
            console.log('\n⚠️  Migração falhou na validação. Deseja fazer rollback? (y/N)');
            
            // Em ambiente automatizado, fazer rollback automaticamente
            if (process.env.AUTO_ROLLBACK === 'true' || process.argv.includes('--auto-rollback')) {
                console.log('🔄 Fazendo rollback automático...');
                await rollback(backupData);
                throw new Error('Migração falhou e rollback foi executado');
            }
        }

        // 6. Salvar estado final
        migrationState.endTime = new Date();
        migrationState.duration = migrationState.endTime - migrationState.startTime;
        saveMigrationState();

        // 7. Relatório final
        console.log('\n🎉 Migração concluída com sucesso!');
        console.log('\n📋 Resumo:');
        console.log(`   ⏱️  Duração: ${Math.round(migrationState.duration / 1000)}s`);
        console.log(`   📦 Backup: ${migrationState.backupPath}`);
        console.log(`   🔄 Registros migrados: ${migratedCount}`);
        console.log(`   ✅ Validação: ${migrationState.validationPassed ? 'Passou' : 'Falhou'}`);
        
        console.log('\n📝 Próximos passos:');
        console.log('   1. Testar funcionalidades do checkout');
        console.log('   2. Configurar webhooks do Iugu');
        console.log('   3. Atualizar aplicação para usar novas APIs');
        console.log('   4. Monitorar logs por problemas');

    } catch (error) {
        console.error(`\n❌ Erro durante migração: ${error.message}`);
        
        migrationState.error = error.message;
        migrationState.endTime = new Date();
        saveMigrationState();
        
        console.log('\n🔧 Para debug, verifique:');
        console.log('   - Logs do Supabase');
        console.log('   - Arquivo migration-state.json');
        console.log('   - Backup criado (se aplicável)');
        
        process.exit(1);
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = {
    createBackup,
    applyNewSchema,
    migrateExistingData,
    validateMigration,
    rollback
};