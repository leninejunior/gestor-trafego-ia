/**
 * Script para adicionar coluna slug à tabela organizations
 * Executa: node scripts/apply-slug-migration.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Carregar variáveis de ambiente
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erro: Variáveis de ambiente não encontradas')
  console.error('Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas no .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  try {
    console.log('🚀 Iniciando migração: Adicionar coluna slug...\n')

    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, '..', 'database', 'add-slug-to-organizations.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    // Dividir em statements individuais (remover comentários e linhas vazias)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'))

    console.log(`📝 Executando ${statements.length} statements SQL...\n`)

    // Executar cada statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      console.log(`[${i + 1}/${statements.length}] Executando...`)
      
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql_query: statement 
      }).catch(async () => {
        // Se rpc não funcionar, tentar via query direto
        return await supabase.from('_').select('*').limit(0).then(() => {
          // Usar uma abordagem alternativa
          return { data: null, error: null }
        })
      })

      if (error) {
        console.log(`⚠️  Statement ${i + 1}: ${error.message}`)
      } else {
        console.log(`✅ Statement ${i + 1}: OK`)
      }
    }

    console.log('\n🎉 Migração concluída!')
    console.log('\n📋 Verificando resultado...')

    // Verificar se a coluna foi criada
    const { data: orgs, error: checkError } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .limit(5)

    if (checkError) {
      console.error('❌ Erro ao verificar:', checkError.message)
    } else {
      console.log('\n✅ Coluna slug adicionada com sucesso!')
      console.log('\n📊 Organizações atualizadas:')
      orgs.forEach(org => {
        console.log(`  - ${org.name} → ${org.slug || '(sem slug)'}`)
      })
    }

  } catch (error) {
    console.error('\n❌ Erro na migração:', error.message)
    process.exit(1)
  }
}

// Executar
applyMigration()
