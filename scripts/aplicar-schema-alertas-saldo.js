/**
 * Script para Aplicar Schema de Alertas de Saldo no Supabase
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function aplicarSchema() {
  console.log('📦 Aplicando Schema de Alertas de Saldo...\n')

  try {
    // Ler arquivo SQL
    const schemaPath = path.join(__dirname, '..', 'database', 'balance-alerts-schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    console.log('📄 Arquivo SQL carregado')
    console.log(`   Tamanho: ${schema.length} caracteres\n`)

    // Dividir em statements individuais
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`📝 Total de statements: ${statements.length}\n`)

    let success = 0
    let errors = 0

    // Executar cada statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      
      // Pular comentários e statements vazios
      if (statement.startsWith('/*') || statement.trim() === ';') {
        continue
      }

      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        
        if (error) {
          // Alguns erros são esperados (tabela já existe, etc)
          if (error.message.includes('already exists')) {
            console.log(`⚠️  ${i + 1}. Já existe (pulando)`)
          } else {
            console.error(`❌ ${i + 1}. Erro:`, error.message.substring(0, 100))
            errors++
          }
        } else {
          console.log(`✅ ${i + 1}. Executado com sucesso`)
          success++
        }
      } catch (err) {
        console.error(`❌ ${i + 1}. Erro:`, err.message)
        errors++
      }
    }

    console.log(`\n📊 Resumo:`)
    console.log(`   ✅ Sucesso: ${success}`)
    console.log(`   ❌ Erros: ${errors}`)

    if (errors === 0) {
      console.log('\n✅ Schema aplicado com sucesso!')
      console.log('\n📋 Próximos passos:')
      console.log('   1. Execute: node scripts/testar-alertas-saldo.js')
      console.log('   2. Acesse: http://localhost:3000/admin/balance')
    } else {
      console.log('\n⚠️  Alguns erros ocorreram. Verifique os logs acima.')
      console.log('   Você pode aplicar o SQL manualmente no Supabase SQL Editor')
    }

  } catch (error) {
    console.error('❌ Erro ao aplicar schema:', error)
    console.log('\n💡 Alternativa:')
    console.log('   1. Abra o Supabase SQL Editor')
    console.log('   2. Cole o conteúdo de database/balance-alerts-schema.sql')
    console.log('   3. Execute o SQL')
  }
}

// Executar
aplicarSchema()
