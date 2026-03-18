require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('========================================');
  console.log('Aplicando Migração de Schema Google Ads');
  console.log('========================================\n');

  try {
    // Ler o arquivo de migração
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'fix-google-ads-schema.sql');
    console.log('📄 Lendo arquivo de migração...');
    console.log(`   Caminho: ${migrationPath}\n`);
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📊 Informações da migração:');
    console.log(`   Tamanho: ${migrationSQL.length} caracteres`);
    console.log(`   Linhas: ${migrationSQL.split('\n').length}\n`);

    // Executar a migração
    console.log('🚀 Executando migração...\n');
    
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // Se a função exec_sql não existir, tentar executar diretamente
      if (error.code === '42883') {
        console.log('⚠️  Função exec_sql não encontrada, tentando método alternativo...\n');
        
        // Dividir o SQL em statements individuais
        const statements = migrationSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📝 Executando ${statements.length} statements...\n`);

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          
          // Pular comentários e blocos DO
          if (statement.startsWith('/*') || statement.startsWith('DO $')) {
            continue;
          }

          try {
            const { error: stmtError } = await supabase.rpc('exec', {
              query: statement + ';'
            });

            if (stmtError) {
              console.log(`⚠️  Statement ${i + 1} falhou (pode ser esperado):`, stmtError.message);
              errorCount++;
            } else {
              successCount++;
            }
          } catch (err) {
            console.log(`⚠️  Statement ${i + 1} erro:`, err.message);
            errorCount++;
          }
        }

        console.log('\n📊 Resultado da execução:');
        console.log(`   Sucesso: ${successCount}`);
        console.log(`   Erros: ${errorCount}\n`);

        if (successCount === 0) {
          throw new Error('Nenhum statement foi executado com sucesso. Você precisa executar o SQL manualmente no Supabase SQL Editor.');
        }
      } else {
        throw error;
      }
    } else {
      console.log('✅ Migração executada com sucesso!\n');
    }

    // Verificar se as colunas foram criadas
    console.log('🔍 Verificando resultado da migração...\n');

    // Verificar google_ads_encryption_keys
    const { data: encryptionCols, error: encryptionError } = await supabase
      .from('google_ads_encryption_keys')
      .select('*')
      .limit(1);

    if (encryptionError) {
      console.log('⚠️  Erro ao verificar google_ads_encryption_keys:', encryptionError.message);
    } else {
      console.log('✅ Tabela google_ads_encryption_keys acessível');
      if (encryptionCols && encryptionCols.length > 0) {
        const cols = Object.keys(encryptionCols[0]);
        console.log('   Colunas:', cols.join(', '));
        
        const requiredCols = ['algorithm', 'version', 'key_hash'];
        const missingCols = requiredCols.filter(col => !cols.includes(col));
        
        if (missingCols.length > 0) {
          console.log('   ⚠️  Colunas faltando:', missingCols.join(', '));
        } else {
          console.log('   ✅ Todas as colunas necessárias presentes');
        }
      }
    }

    // Verificar google_ads_audit_log
    const { data: auditCols, error: auditError } = await supabase
      .from('google_ads_audit_log')
      .select('*')
      .limit(1);

    if (auditError) {
      console.log('⚠️  Erro ao verificar google_ads_audit_log:', auditError.message);
    } else {
      console.log('✅ Tabela google_ads_audit_log acessível');
      if (auditCols && auditCols.length > 0) {
        const cols = Object.keys(auditCols[0]);
        console.log('   Colunas:', cols.join(', '));
        
        const requiredCols = ['client_id', 'connection_id', 'operation', 'metadata'];
        const missingCols = requiredCols.filter(col => !cols.includes(col));
        
        if (missingCols.length > 0) {
          console.log('   ⚠️  Colunas faltando:', missingCols.join(', '));
        } else {
          console.log('   ✅ Todas as colunas necessárias presentes');
        }
      }
    }

    console.log('\n========================================');
    console.log('⚠️  IMPORTANTE: Método Alternativo');
    console.log('========================================\n');
    console.log('O Supabase pode não permitir execução de SQL complexo via API.');
    console.log('Se as verificações acima mostrarem colunas faltando:\n');
    console.log('1. Abra o Supabase Dashboard');
    console.log('2. Vá para SQL Editor');
    console.log('3. Copie o conteúdo de: database/migrations/fix-google-ads-schema.sql');
    console.log('4. Cole no SQL Editor e execute');
    console.log('5. Execute este script novamente para verificar\n');

  } catch (error) {
    console.error('\n❌ Erro ao aplicar migração:', error.message);
    console.error('\n📋 Instruções para aplicação manual:');
    console.error('1. Abra: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql');
    console.error('2. Copie o conteúdo de: database/migrations/fix-google-ads-schema.sql');
    console.error('3. Cole no SQL Editor');
    console.error('4. Clique em "Run" para executar');
    console.error('5. Execute este script novamente para verificar\n');
    process.exit(1);
  }
}

applyMigration();
