/**
 * Script para aplicar o schema de Balance Alerts no Supabase
 * Executa: node scripts/apply-balance-schema.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas!')
  console.error('Certifique-se de ter NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyBalanceSchema() {
  try {
    console.log('🚀 Aplicando schema de Balance Alerts...\n')

    // Ler o arquivo SQL
    const schemaPath = path.join(__dirname, '..', 'database', 'balance-alerts-schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    // Dividir em statements individuais (separados por ponto e vírgula)
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`📝 Encontrados ${statements.length} statements SQL\n`)

    // Executar cada statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      // Pular comentários e statements vazios
      if (statement.startsWith('/*') || statement.length < 10) {
        continue
      }

      try {
        console.log(`⏳ Executando statement ${i + 1}/${statements.length}...`)
        
        const { error } = await supabase.rpc('exec_sql', { 
          sql_query: statement + ';' 
        })

        if (error) {
          // Alguns erros são esperados (tabela já existe, etc)
          if (error.message.includes('already exists')) {
            console.log(`⚠️  Já existe (pulando): ${error.message.substring(0, 80)}...`)
          } else {
            console.error(`❌ Erro: ${error.message}`)
          }
        } else {
          console.log(`✅ Statement ${i + 1} executado com sucesso`)
        }
      } catch (err) {
        console.error(`❌ Erro ao executar statement ${i + 1}:`, err.message)
      }
    }

    console.log('\n✅ Schema de Balance Alerts aplicado com sucesso!')
    console.log('\n📊 Verificando tabelas criadas...\n')

    // Verificar tabelas criadas
    const tables = ['balance_alerts', 'whatsapp_config', 'alert_history', 'alert_recipients']
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.log(`❌ Tabela ${table}: Erro - ${error.message}`)
      } else {
        console.log(`✅ Tabela ${table}: ${count || 0} registros`)
      }
    }

    console.log('\n🎉 Processo concluído!')
    console.log('\n📝 Próximos passos:')
    console.log('1. Conecte contas Meta Ads no dashboard')
    console.log('2. Configure alertas de saldo em /admin/balance')
    console.log('3. Os saldos serão atualizados automaticamente via API do Meta')

  } catch (error) {
    console.error('❌ Erro ao aplicar schema:', error)
    process.exit(1)
  }
}

// Executar
applyBalanceSchema()
