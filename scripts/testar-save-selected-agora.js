/**
 * Script para testar a API save-selected
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando estrutura da API Meta...\n');

// Verificar se os arquivos existem
const apiPath = path.join(process.cwd(), 'src', 'app', 'api', 'meta');
const saveSelectedPath = path.join(apiPath, 'save-selected', 'route.ts');

console.log('📁 Caminho da API:', apiPath);
console.log('📄 Arquivo save-selected:', saveSelectedPath);
console.log('✅ Arquivo existe:', fs.existsSync(saveSelectedPath));

if (fs.existsSync(saveSelectedPath)) {
  const content = fs.readFileSync(saveSelectedPath, 'utf-8');
  console.log('\n📝 Primeiras linhas do arquivo:');
  console.log(content.split('\n').slice(0, 10).join('\n'));
}

// Listar todas as rotas na pasta meta
console.log('\n📂 Rotas disponíveis em /api/meta:');
const metaRoutes = fs.readdirSync(apiPath);
metaRoutes.forEach(route => {
  const routePath = path.join(apiPath, route);
  const isDir = fs.statSync(routePath).isDirectory();
  if (isDir) {
    const hasRoute = fs.existsSync(path.join(routePath, 'route.ts'));
    console.log(`  ${hasRoute ? '✅' : '❌'} /${route}`);
  }
});

console.log('\n💡 Próximos passos:');
console.log('1. Reinicie o servidor Next.js (npm run dev)');
console.log('2. Limpe o cache do Next.js (rm -rf .next)');
console.log('3. Teste a URL: http://localhost:3000/api/meta/save-selected');
