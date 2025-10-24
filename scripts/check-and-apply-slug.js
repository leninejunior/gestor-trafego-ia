const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Carregar .env manualmente
const envPath = path.join(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        let value = match[2].trim()
        // Remover aspas se existirem
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        process.env[key] = value
      }
    }
  })
}

async function checkAndApplySlug() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variáveis de ambiente não encontradas')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('🔍 Verificando se a coluna slug existe...')

  // Tentar buscar uma organização com slug
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .limit(1)

  if (error) {
    if (error.message.includes('slug')) {
      console.log('❌ Coluna slug não existe. Aplicando migração...')
      
      // Ler o arquivo SQL
      const sqlPath = path.join(__dirname, '..', 'database', 'add-slug-to-organizations.sql')
      const sql = fs.readFileSync(sqlPath, 'utf8')
      
      console.log('📝 SQL a ser executado:')
      console.log(sql)
      console.log('\n⚠️  IMPORTANTE: Execute este SQL manualmente no Supabase SQL Editor:')
      console.log('1. Acesse: https://supabase.com/dashboard/project/_/sql')
      console.log('2. Cole o SQL acima')
      console.log('3. Clique em "Run"')
      console.log('\nOu use o arquivo: database/add-slug-to-organizations.sql')
      
      process.exit(1)
    } else {
      console.error('❌ Erro ao verificar:', error.message)
      process.exit(1)
    }
  }

  console.log('✅ Coluna slug existe!')
  console.log('📊 Exemplo de organização:', data)
  
  // Verificar se há organizações sem slug
  const { data: orgsWithoutSlug, error: checkError } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .or('slug.is.null,slug.eq.')

  if (checkError) {
    console.error('❌ Erro ao verificar organizações sem slug:', checkError.message)
  } else if (orgsWithoutSlug && orgsWithoutSlug.length > 0) {
    console.log(`⚠️  Encontradas ${orgsWithoutSlug.length} organizações sem slug:`)
    orgsWithoutSlug.forEach(org => {
      console.log(`   - ${org.name} (ID: ${org.id})`)
    })
    console.log('\n💡 Execute o UPDATE no SQL Editor para gerar slugs automaticamente')
  } else {
    console.log('✅ Todas as organizações têm slug!')
  }
}

checkAndApplySlug()
