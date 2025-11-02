/**
 * Script para aplicar schema de health checks
 * 
 * Aplica as tabelas e funções necessárias para o sistema de health checks
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas')
  console.error('Necessário: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyHealthChecksSchema() {
  try {
    console.log('🔧 Aplicando schema de health checks...')

    // Ler o arquivo de schema
    const schemaPath = path.join(__dirname, '..', 'database', 'health-checks-schema.sql')
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8')

    // Executar o schema
    const { error } = await supabase.rpc('exec_sql', { sql: schemaSQL })

    if (error) {
      console.error('❌ Erro ao aplicar schema:', error)
      return false
    }

    console.log('✅ Schema de health checks aplicado com sucesso')

    // Criar agendamentos padrão
    console.log('📅 Criando agendamentos padrão de health checks...')

    const defaultSchedules = [
      {
        name: 'System Health Check',
        endpoint: 'full',
        interval_minutes: 15,
        max_failures_before_alert: 3
      },
      {
        name: 'Quick Health Check',
        endpoint: 'quick',
        interval_minutes: 5,
        max_failures_before_alert: 5
      },
      {
        name: 'Database Connectivity',
        endpoint: 'database',
        interval_minutes: 2,
        max_failures_before_alert: 3
      },
      {
        name: 'Iugu API Connectivity',
        endpoint: 'iugu',
        interval_minutes: 10,
        max_failures_before_alert: 2
      },
      {
        name: 'Checkout System Check',
        endpoint: 'checkout',
        interval_minutes: 10,
        max_failures_before_alert: 3
      }
    ]

    for (const schedule of defaultSchedules) {
      // Verificar se já existe
      const { data: existing } = await supabase
        .from('health_check_schedules')
        .select('id')
        .eq('name', schedule.name)
        .single()

      if (!existing) {
        const { error: insertError } = await supabase
          .from('health_check_schedules')
          .insert({
            name: schedule.name,
            endpoint: schedule.endpoint,
            interval_minutes: schedule.interval_minutes,
            enabled: true,
            consecutive_failures: 0,
            max_failures_before_alert: schedule.max_failures_before_alert,
            next_run: new Date().toISOString()
          })

        if (insertError) {
          console.error(`❌ Erro ao criar agendamento ${schedule.name}:`, insertError)
        } else {
          console.log(`✅ Agendamento criado: ${schedule.name}`)
        }
      } else {
        console.log(`ℹ️  Agendamento já existe: ${schedule.name}`)
      }
    }

    return true

  } catch (error) {
    console.error('❌ Erro geral:', error)
    return false
  }
}

async function testHealthChecks() {
  try {
    console.log('🧪 Testando sistema de health checks...')

    // Testar endpoint principal
    const healthResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/health`)
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json()
      console.log('✅ Endpoint de health check funcionando')
      console.log(`   Status: ${healthData.status}`)
      console.log(`   Componentes verificados: ${healthData.checks?.length || 0}`)
    } else {
      console.error('❌ Endpoint de health check não está funcionando')
    }

    // Verificar tabelas criadas
    const { data: schedules, error: schedulesError } = await supabase
      .from('health_check_schedules')
      .select('count')
      .single()

    if (!schedulesError) {
      console.log('✅ Tabela health_check_schedules acessível')
    } else {
      console.error('❌ Erro ao acessar tabela health_check_schedules:', schedulesError)
    }

    const { data: logs, error: logsError } = await supabase
      .from('health_check_logs')
      .select('count')
      .single()

    if (!logsError) {
      console.log('✅ Tabela health_check_logs acessível')
    } else {
      console.error('❌ Erro ao acessar tabela health_check_logs:', logsError)
    }

    return true

  } catch (error) {
    console.error('❌ Erro nos testes:', error)
    return false
  }
}

async function main() {
  console.log('🚀 Configurando sistema de health checks...\n')

  const schemaSuccess = await applyHealthChecksSchema()
  
  if (schemaSuccess) {
    console.log('\n🧪 Executando testes...\n')
    await testHealthChecks()
  }

  console.log('\n📋 Próximos passos:')
  console.log('1. Configure um cron job para executar /api/cron/health-checks a cada 5 minutos')
  console.log('2. Acesse /api/health para verificar o status do sistema')
  console.log('3. Use /api/admin/health-checks/schedules para gerenciar agendamentos')
  console.log('4. Monitore logs em /api/admin/health-checks/logs')
  console.log('5. Visualize estatísticas em /api/admin/health-checks/statistics')

  console.log('\n✨ Configuração de health checks concluída!')
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { applyHealthChecksSchema, testHealthChecks }