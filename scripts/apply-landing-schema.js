#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

console.log('📋 Schema de Leads da Landing Page\n')
console.log('Para aplicar o schema, siga um dos métodos abaixo:\n')

console.log('MÉTODO 1 - Supabase Dashboard (Recomendado):')
console.log('1. Acesse: https://supabase.com/dashboard')
console.log('2. Selecione seu projeto')
console.log('3. Vá em "SQL Editor"')
console.log('4. Copie o conteúdo do arquivo: database/landing-leads-schema.sql')
console.log('5. Cole no editor e execute\n')

console.log('MÉTODO 2 - Copiar SQL para área de transferência:')
console.log('O conteúdo do SQL está abaixo. Copie e execute no Supabase:\n')
console.log('─'.repeat(80))

try {
  const schemaPath = path.join(__dirname, '..', 'database', 'landing-leads-schema.sql')
  const schema = fs.readFileSync(schemaPath, 'utf8')
  console.log(schema)
  console.log('─'.repeat(80))
  console.log('\n✅ SQL carregado com sucesso!')
  console.log('\n📝 Próximos passos:')
  console.log('1. Copie o SQL acima')
  console.log('2. Execute no Supabase SQL Editor')
  console.log('3. Acesse /admin/leads para gerenciar leads')
  console.log('4. Teste o formulário em /')
} catch (error) {
  console.error('❌ Erro ao ler arquivo:', error.message)
  console.log('\n💡 Execute manualmente o arquivo: database/landing-leads-schema.sql')
  process.exit(1)
}
