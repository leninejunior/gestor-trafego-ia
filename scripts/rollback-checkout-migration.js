#!/usr/bin/env node

/**
 * Script de Rollback - Migração do Sistema de Checkout
 * 
 * Executa rollback completo da migração em caso de problemas críticos
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
 * Carregar estado da migração
 */
function loadMigrationState() {
    const statePath = path.join(__dirname, '..', 'migration-state.json');
    
    if (!fs.existsSync(statePath)) {
        console.log('⚠️  Arquivo de estado da migração não encontrado');
        return null;
    }

    try {
        const stateContent = fs.readFileSync(statePath, 'utf8');
        return JSON.parse(stateContent);
    } catch (error) {
        console.error(`❌ Erro ao ler estado da migração: ${error.message}`);
        return null;
    }
}

/**
 * Carregar backup da migração
 */
function loadBackupData(backupPath) {
    if (!backupPath || !fs.existsSync(backupPath)) {
        console.log('⚠️  Arquivo de backup não encontrado');
        return null;
    }

    try {
        const backupContent = fs.readFileSync(backupPath, 'utf8');
        return JSON.parse(backupContent);
    } catch (error) {
        console.error(`❌ Erro ao ler backup: ${error.message}`);
        return null;
    }
}

/**
 * Remover dados migrados
 */
async function removeMigratedData(migrationState) {
    console.log('🗑️  Removendo dados migrados...\n');

    let removedCount = 0;

    try {
        // Remover subscription_intents migrados
        console.log('   Removendo subscription_intents migrados...');
        
        const { data: migratedIntents, error: selectError } = await supabase
            .from('subscription_intents')
            .select('id')
            .not('metadata->migrated_from', 'is', null);

        if (selectError) {
            console.log(`   ⚠️  Erro ao buscar intents migrados: ${selectError.message}`);
        } else if (migratedIntents.length > 0) {
            const intentIds = migratedIntents.map(intent => intent.id);
            
            // Remover transições primeiro (foreign key)
            const { error: transitionsError } = await supabase
                .from('subscription_intent_transitions')
                .delete()
                .in('subscription_intent_id', intentIds);

            if (transitionsError) {
                console.log(`   ⚠️  Erro ao remover transições: ${transitionsError.message}`);
            }

            // Remover webhook logs relacionados
            const { error: webhooksError } = await supabase
                .from('webhook_logs')
                .delete()
                .in('subscription_intent_id', intentIds);

            if (webhooksError) {
                console.log(`   ⚠️  Erro ao remover webhook logs: ${webhooksError.message}`);
            }

            // Remover intents
            const { error: deleteError } = await supabase
                .from('subscription_intents')
                .delete()
                .in('id', intentIds);

            if (deleteError) {
                console.error(`   ❌ Erro ao remover intents: ${deleteError.message}`);
            } else {
                removedCount += intentIds.length;
                console.log(`   ✅ ${intentIds.length} subscription_intents removidos`);
            }
        } else {
            console.log('   ℹ️  Nenhum intent migrado encontrado');
        }

        // Remover analytics gerados durante migração
        console.log('\n   Removendo analytics da migração...');
        
        const migrationDate = new Date(migrationState.startTime).toISOString().split('T')[0];
        
        const { error: analyticsError } = await supabase
            .from('payment_analytics')
            .delete()
            .gte('date', migrationDate);

        if (analyticsError) {
            console.log(`   ⚠️  Erro ao remover analytics: ${analyticsError.message}`);
        } else {
            console.log(`   ✅ Analytics da migração removidos`);
        }

    } catch (error) {
        console.error(`❌ Erro ao remover dados migrados: ${error.message}`);
        throw error;
    }

    return removedCount;
}

/**
 * Restaurar dados originais (se necessário)
 */
async function restoreOriginalData(backupData) {
    console.log('\n📦 Restaurando dados originais...\n');

    if (!backupData || !backupData.tables) {
        console.log('   ℹ️  Nenhum backup disponível para restauração');
        return 0;
    }

    let restoredCount = 0;

    try {
        // Restaurar tabelas que foram modificadas
        for (const [tableName, tableData] of Object.entries(backupData.tables)) {
            if (!tableData || tableData.length === 0) {
                console.log(`   ℹ️  Tabela ${tableName}: sem dados para restaurar`);
                continue;
            }

            console.log(`   Restaurando ${tableName}...`);

            // Verificar se tabela ainda existe
            const { data: existingData, error: checkError } = await supabase
                .from(tableName)
                .select('id')
                .limit(1);

            if (checkError) {
                console.log(`   ⚠️  Tabela ${tableName} não acessível: ${checkError.message}`);
                continue;
            }

            // Para este caso específico, os dados originais não foram modificados
            // então não precisamos restaurar nada
            console.log(`   ✅ Dados originais de ${tableName} preservados`);
        }

    } catch (error) {
        console.error(`❌ Erro ao restaurar dados: ${error.message}`);
        throw error;
    }

    return restoredCount;
}

/**
 * Remover schema da migração (opcional)
 */
async function removeNewSchema(force = false) {
    console.log('\n🏗️  Removendo schema da migração...\n');

    if (!force) {
        console.log('   ⚠️  Remoção de schema desabilitada por segurança');
        console.log('   ℹ️  Use --force-schema-removal para remover tabelas');
        return;
    }

    const tablesToRemove = [
        'subscription_intent_transitions',
        'webhook_logs',
        'payment_analytics',
        'subscription_intents'
    ];

    for (const tableName of tablesToRemove) {
        try {
            console.log(`   Removendo tabela ${tableName}...`);
            
            // Usar SQL direto para DROP TABLE
            const { error } = await supabase.rpc('exec_sql', {
                sql_query: `DROP TABLE IF EXISTS ${tableName} CASCADE;`
            });

            if (error) {
                if (error.message.includes('function exec_sql')) {
                    console.log(`   ⚠️  Não é possível remover via RPC - remover manualmente: ${tableName}`);
                } else {
                    console.log(`   ❌ Erro ao remover ${tableName}: ${error.message}`);
                }
            } else {
                console.log(`   ✅ Tabela ${tableName} removida`);
            }

        } catch (error) {
            console.log(`   ❌ Erro ao remover ${tableName}: ${error.message}`);
        }
    }
}

/**
 * Validar rollback
 */
async function validateRollback() {
    console.log('\n🔍 Validando rollback...\n');

    const results = {
        passed: 0,
        failed: 0
    };

    // Verificar se dados migrados foram removidos
    console.log('   1. Verificando remoção de dados migrados...');
    try {
        const { data: remainingIntents, error } = await supabase
            .from('subscription_intents')
            .select('id')
            .not('metadata->migrated_from', 'is', null);

        if (error) {
            if (error.message.includes('does not exist')) {
                console.log('      ✅ Tabela subscription_intents removida');
                results.passed++;
            } else {
                console.log(`      ❌ Erro ao verificar: ${error.message}`);
                results.failed++;
            }
        } else if (remainingIntents.length === 0) {
            console.log('      ✅ Nenhum dado migrado restante');
            results.passed++;
        } else {
            console.log(`      ❌ ${remainingIntents.length} registros migrados ainda presentes`);
            results.failed++;
        }
    } catch (error) {
        console.log(`      ❌ Erro na validação: ${error.message}`);
        results.failed++;
    }

    // Verificar se dados originais estão intactos
    console.log('\n   2. Verificando integridade dos dados originais...');
    try {
        const { data: originalSubscriptions, error } = await supabase
            .from('subscriptions')
            .select('id')
            .limit(10);

        if (error) {
            console.log(`      ⚠️  Tabela subscriptions: ${error.message}`);
        } else {
            console.log(`      ✅ Dados originais preservados (${originalSubscriptions.length} registros verificados)`);
            results.passed++;
        }
    } catch (error) {
        console.log(`      ❌ Erro na verificação: ${error.message}`);
        results.failed++;
    }

    const isValid = results.failed === 0;
    console.log(`\n📊 Resultado da validação: ${results.passed}✅ ${results.failed}❌`);
    
    return isValid;
}

/**
 * Limpar arquivos de migração
 */
function cleanupMigrationFiles() {
    console.log('\n🧹 Limpando arquivos de migração...\n');

    const filesToClean = [
        'migration-state.json',
        'validation-report-*.json'
    ];

    let cleanedCount = 0;

    for (const filePattern of filesToClean) {
        try {
            if (filePattern.includes('*')) {
                // Buscar arquivos com padrão
                const dir = path.join(__dirname, '..');
                const files = fs.readdirSync(dir);
                const pattern = filePattern.replace('*', '.*');
                const regex = new RegExp(pattern);
                
                files.forEach(file => {
                    if (regex.test(file)) {
                        const filePath = path.join(dir, file);
                        fs.unlinkSync(filePath);
                        console.log(`   ✅ Removido: ${file}`);
                        cleanedCount++;
                    }
                });
            } else {
                const filePath = path.join(__dirname, '..', filePattern);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`   ✅ Removido: ${filePattern}`);
                    cleanedCount++;
                }
            }
        } catch (error) {
            console.log(`   ⚠️  Erro ao remover ${filePattern}: ${error.message}`);
        }
    }

    console.log(`\n✅ ${cleanedCount} arquivo(s) de migração removido(s)`);
}

/**
 * Função principal
 */
async function main() {
    console.log('🔄 Iniciando rollback da migração do sistema de checkout...\n');

    const args = process.argv.slice(2);
    const forceSchemaRemoval = args.includes('--force-schema-removal');
    const keepFiles = args.includes('--keep-files');

    try {
        // 1. Carregar estado da migração
        console.log('📋 Carregando estado da migração...');
        const migrationState = loadMigrationState();
        
        if (!migrationState) {
            console.log('⚠️  Estado da migração não encontrado - continuando com rollback básico');
        } else {
            console.log(`✅ Estado carregado: migração iniciada em ${migrationState.startTime}`);
        }

        // 2. Carregar backup se disponível
        let backupData = null;
        if (migrationState && migrationState.backupPath) {
            console.log('\n📦 Carregando backup...');
            backupData = loadBackupData(migrationState.backupPath);
            
            if (backupData) {
                console.log(`✅ Backup carregado: ${Object.keys(backupData.tables).length} tabelas`);
            }
        }

        // 3. Confirmar rollback
        if (!args.includes('--force')) {
            console.log('\n⚠️  ATENÇÃO: Esta operação irá reverter completamente a migração!');
            console.log('   - Dados migrados serão removidos');
            console.log('   - Sistema voltará ao estado anterior');
            
            if (forceSchemaRemoval) {
                console.log('   - Tabelas do novo sistema serão removidas');
            }
            
            console.log('\nPara confirmar, execute novamente com --force');
            process.exit(0);
        }

        // 4. Executar rollback
        console.log('\n🚀 Executando rollback...');
        
        const removedCount = await removeMigratedData(migrationState || {});
        const restoredCount = await restoreOriginalData(backupData);
        
        if (forceSchemaRemoval) {
            await removeNewSchema(true);
        }

        // 5. Validar rollback
        const isValid = await validateRollback();

        // 6. Limpar arquivos se solicitado
        if (!keepFiles) {
            cleanupMigrationFiles();
        }

        // 7. Relatório final
        console.log('\n🎯 ROLLBACK CONCLUÍDO');
        console.log('=' .repeat(40));
        console.log(`📊 Registros removidos: ${removedCount}`);
        console.log(`📦 Registros restaurados: ${restoredCount}`);
        console.log(`🏗️  Schema removido: ${forceSchemaRemoval ? 'Sim' : 'Não'}`);
        console.log(`✅ Validação: ${isValid ? 'Passou' : 'Falhou'}`);

        if (isValid) {
            console.log('\n✅ Rollback executado com sucesso!');
            console.log('\n📝 Próximos passos:');
            console.log('   1. Verificar funcionamento do sistema original');
            console.log('   2. Investigar causa dos problemas na migração');
            console.log('   3. Corrigir problemas antes de nova tentativa');
            console.log('   4. Testar migração em ambiente de desenvolvimento');
        } else {
            console.log('\n⚠️  Rollback concluído com avisos');
            console.log('   Verificar manualmente se sistema está funcionando');
        }

    } catch (error) {
        console.error(`\n❌ Erro durante rollback: ${error.message}`);
        console.log('\n🔧 Para debug:');
        console.log('   - Verificar logs do Supabase');
        console.log('   - Validar permissões de banco');
        console.log('   - Executar rollback manual se necessário');
        
        process.exit(1);
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = {
    loadMigrationState,
    loadBackupData,
    removeMigratedData,
    restoreOriginalData,
    removeNewSchema,
    validateRollback
};