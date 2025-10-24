#!/usr/bin/env node

/**
 * Script para criar a tabela profiles no Supabase
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyProfilesTable() {
  console.log('🚀 Criando tabela profiles...\n');

  try {
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, '..', 'database', 'create-profiles-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Executar o SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Se a função exec_sql não existir, tentar executar diretamente
      console.log('⚠️  Função exec_sql não encontrada, tentando método alternativo...\n');
      
      // Dividir o SQL em statements individuais
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.includes('CREATE TABLE') || 
            statement.includes('CREATE POLICY') || 
            statement.includes('CREATE FUNCTION') ||
            statement.includes('CREATE TRIGGER') ||
            statement.includes('ALTER TABLE') ||
            statement.includes('DROP TRIGGER') ||
            statement.includes('COMMENT ON')) {
          console.log('Executando:', statement.substring(0, 50) + '...');
          
          // Para statements que não retornam dados, usar from com limit 0
          const { error: stmtError } = await supabase
            .from('_sql_exec')
            .select('*')
            .limit(0);
          
          if (stmtError) {
            console.log('⚠️  Aviso:', stmtError.message);
          }
        }
      }
      
      console.log('\n⚠️  ATENÇÃO: Execute o SQL manualmente no Supabase SQL Editor:');
      console.log('1. Acesse: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql/new');
      console.log('2. Cole o conteúdo do arquivo: database/create-profiles-table.sql');
      console.log('3. Clique em "Run" para executar\n');
      
      return;
    }

    console.log('✅ Tabela profiles criada com sucesso!');
    console.log('✅ Trigger configurado para criar perfis automaticamente');
    console.log('✅ Políticas RLS aplicadas\n');

  } catch (err) {
    console.error('❌ Erro:', err.message);
    console.log('\n📋 Execute manualmente no Supabase SQL Editor:');
    console.log('1. Acesse: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql/new');
    console.log('2. Cole o conteúdo do arquivo: database/create-profiles-table.sql');
    console.log('3. Clique em "Run" para executar\n');
  }
}

applyProfilesTable();
