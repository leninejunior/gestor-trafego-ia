/**
 * Script para aplicar schema das funcionalidades avançadas
 * - Push subscriptions
 * - Workflows e automações
 * - Webhooks e logs
 * - API pública
 * - Sistema de backup
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas')
  console.log('Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyAdvancedFeaturesSchema() {
  console.log('🚀 Aplicando schema das funcionalidades avançadas...')

  try {
    // Ler arquivo SQL
    const schemaPath = path.join(__dirname, '..', 'database', 'advanced-features-schema.sql')
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8')

    // Dividir em comandos individuais
    const commands = schemaSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'))

    console.log(`📝 Executando ${commands.length} comandos SQL...`)

    let successCount = 0
    let errorCount = 0

    // Executar comandos sequencialmente
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i]
      
      try {
        console.log(`⏳ Executando comando ${i + 1}/${commands.length}...`)
        
        const { error } = await supabase.rpc('exec_sql', { 
          sql_query: command + ';' 
        })

        if (error) {
          console.error(`❌ Erro no comando ${i + 1}:`, error.message)
          errorCount++
        } else {
          successCount++
        }
      } catch (err) {
        console.error(`❌ Erro no comando ${i + 1}:`, err.message)
        errorCount++
      }
    }

    console.log('\n📊 Resumo da execução:')
    console.log(`✅ Sucessos: ${successCount}`)
    console.log(`❌ Erros: ${errorCount}`)

    if (errorCount === 0) {
      console.log('🎉 Schema das funcionalidades avançadas aplicado com sucesso!')
    } else {
      console.log('⚠️ Schema aplicado com alguns erros. Verifique os logs acima.')
    }

    // Testar estrutura criada
    console.log('\n🧪 Testando estrutura...')
    await testAdvancedFeaturesStructure()

  } catch (error) {
    console.error('❌ Erro ao aplicar schema:', error)
    process.exit(1)
  }
}

async function testAdvancedFeaturesStructure() {
  const tables = [
    'push_subscriptions',
    'scheduled_notifications', 
    'workflows',
    'workflow_executions',
    'webhook_logs',
    'api_configurations',
    'api_keys',
    'api_usage_logs',
    'backup_logs',
    'system_metrics',
    'system_alerts'
  ]

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

      if (error) {
        console.log(`❌ Tabela ${table}: ${error.message}`)
      } else {
        console.log(`✅ Tabela ${table}: OK`)
      }
    } catch (err) {
      console.log(`❌ Tabela ${table}: ${err.message}`)
    }
  }

  // Testar funções
  console.log('\n🔧 Testando funções...')
  
  try {
    const { data, error } = await supabase.rpc('generate_api_key')
    if (error) {
      console.log(`❌ Função generate_api_key: ${error.message}`)
    } else {
      console.log(`✅ Função generate_api_key: OK (${data})`)
    }
  } catch (err) {
    console.log(`❌ Função generate_api_key: ${err.message}`)
  }

  try {
    const { data, error } = await supabase.rpc('hash_api_key', { key: 'test_key' })
    if (error) {
      console.log(`❌ Função hash_api_key: ${error.message}`)
    } else {
      console.log(`✅ Função hash_api_key: OK`)
    }
  } catch (err) {
    console.log(`❌ Função hash_api_key: ${err.message}`)
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  applyAdvancedFeaturesSchema()
    .then(() => {
      console.log('\n🎊 Processo concluído!')
      console.log('\n📋 Próximos passos:')
      console.log('1. Configurar VAPID keys para push notifications')
      console.log('2. Configurar webhooks da Meta Ads API')
      console.log('3. Testar sistema de notificações')
      console.log('4. Criar workflows de exemplo')
      console.log('5. Configurar backup automático')
      process.exit(0)
    })
    .catch(error => {
      console.error('💥 Falha na execução:', error)
      process.exit(1)
    })
}

module.exports = { applyAdvancedFeaturesSchema }