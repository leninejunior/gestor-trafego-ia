require('dotenv').config();

console.log('🔧 Aplicando Correções de RLS para Super Admin');
console.log('==============================================');

console.log('\n📝 EXECUTE ESTE SQL NO SUPABASE SQL EDITOR:');
console.log('==========================================');

const fs = require('fs');
const sqlScript = fs.readFileSync('database/fix-super-admin-rls.sql', 'utf8');

console.log(sqlScript);

console.log('==========================================');
console.log('\n⚠️  IMPORTANTE:');
console.log('1. Copie o SQL acima');
console.log('2. Cole no SQL Editor do Supabase');
console.log('3. Execute o script');
console.log('4. Depois rode: node scripts/testar-super-admin-acesso.js');

console.log('\n✅ Script de correção preparado!');