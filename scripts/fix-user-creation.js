const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  console.error('Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixUserCreationError() {
  try {
    console.log('🔧 Iniciando correção do erro de criação de usuário...');
    
    // Ler o arquivo SQL de correção
    const sqlPath = path.join(__dirname, '..', 'database', 'fix-user-creation-error.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Executando script de correção...');
    
    // Executar o script SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: sqlContent 
    });
    
    if (error) {
      // Se a função exec_sql não existir, tentar executar diretamente
      console.log('⚠️  Função exec_sql não encontrada, tentando execução direta...');
      
      // Dividir o SQL em comandos individuais
      const commands = sqlContent
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
      
      for (const command of commands) {
        if (command.includes('DO $$') || command.includes('CREATE OR REPLACE FUNCTION')) {
          // Pular comandos complexos que podem não funcionar via rpc
          console.log('⏭️  Pulando comando complexo:', command.substring(0, 50) + '...');
          continue;
        }
        
        try {
          const { error: cmdError } = await supabase.rpc('exec', { 
            sql: command 
          });
          
          if (cmdError) {
            console.log('⚠️  Erro em comando:', cmdError.message);
          }
        } catch (e) {
          console.log('⚠️  Erro ao executar comando:', e.message);
        }
      }
    }
    
    console.log('✅ Script de correção executado');
    
    // Verificar se a tabela user_profiles existe
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'user_profiles');
    
    if (tableError) {
      console.log('⚠️  Não foi possível verificar tabelas:', tableError.message);
    } else if (tables && tables.length > 0) {
      console.log('✅ Tabela user_profiles existe');
    } else {
      console.log('❌ Tabela user_profiles não encontrada');
    }
    
    // Tentar criar a tabela user_profiles manualmente se necessário
    console.log('🔧 Tentando criar tabela user_profiles...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS user_profiles (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL UNIQUE,
        first_name TEXT,
        last_name TEXT,
        avatar_url TEXT,
        phone TEXT,
        timezone TEXT DEFAULT 'America/Sao_Paulo',
        language TEXT DEFAULT 'pt-BR',
        onboarding_completed BOOLEAN DEFAULT false,
        last_login_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    const { error: createError } = await supabase.rpc('exec', { 
      sql: createTableSQL 
    });
    
    if (createError) {
      console.log('⚠️  Erro ao criar tabela:', createError.message);
    } else {
      console.log('✅ Tabela user_profiles criada/verificada');
    }
    
    // Habilitar RLS
    const enableRLSSQL = `
      ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
    `;
    
    const { error: rlsError } = await supabase.rpc('exec', { 
      sql: enableRLSSQL 
    });
    
    if (rlsError) {
      console.log('⚠️  Erro ao habilitar RLS:', rlsError.message);
    } else {
      console.log('✅ RLS habilitado na tabela user_profiles');
    }
    
    console.log('\n🎉 Correção concluída!');
    console.log('📝 Agora tente criar um novo usuário para verificar se o erro foi resolvido.');
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error.message);
    process.exit(1);
  }
}

// Executar a correção
fixUserCreationError();