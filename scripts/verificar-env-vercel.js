/**
 * Script para verificar variáveis de ambiente necessárias
 */

const requiredEnvVars = {
  'NEXT_PUBLIC_SUPABASE_URL': 'URL do Supabase',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'Chave anônima do Supabase',
  'SUPABASE_SERVICE_ROLE_KEY': 'Chave de service role do Supabase (CRÍTICA)',
  'META_APP_ID': 'ID do App Meta',
  'META_APP_SECRET': 'Secret do App Meta',
  'NEXT_PUBLIC_APP_URL': 'URL da aplicação'
};

console.log('🔍 Verificando variáveis de ambiente...\n');

let missingVars = [];
let presentVars = [];

for (const [varName, description] of Object.entries(requiredEnvVars)) {
  const value = process.env[varName];
  
  if (!value) {
    console.log(`❌ ${varName}`);
    console.log(`   Descrição: ${description}`);
    console.log(`   Status: AUSENTE\n`);
    missingVars.push(varName);
  } else {
    console.log(`✅ ${varName}`);
    console.log(`   Descrição: ${description}`);
    console.log(`   Status: PRESENTE`);
    console.log(`   Valor: ${value.substring(0, 20)}...\n`);
    presentVars.push(varName);
  }
}

console.log('\n📊 RESUMO:');
console.log(`✅ Configuradas: ${presentVars.length}/${Object.keys(requiredEnvVars).length}`);
console.log(`❌ Faltando: ${missingVars.length}/${Object.keys(requiredEnvVars).length}`);

if (missingVars.length > 0) {
  console.log('\n⚠️ ATENÇÃO: As seguintes variáveis estão faltando:');
  missingVars.forEach(v => console.log(`   - ${v}`));
  console.log('\n📖 Leia o arquivo CONFIGURAR_VERCEL_URGENTE.md para instruções');
  process.exit(1);
} else {
  console.log('\n✅ Todas as variáveis necessárias estão configuradas!');
  process.exit(0);
}
