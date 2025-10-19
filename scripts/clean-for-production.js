#!/usr/bin/env node

/**
 * Script para limpar arquivos de desenvolvimento antes do deploy
 * Remove console.logs, comentários de debug, etc.
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Limpando projeto para produção...\n');

let filesProcessed = 0;
let consolesRemoved = 0;

// Função para processar arquivo
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Remover console.log, console.debug, console.info
    const originalContent = content;
    content = content.replace(/console\.(log|debug|info)\([^)]*\);?\n?/g, '');
    
    if (content !== originalContent) {
      const removed = (originalContent.match(/console\.(log|debug|info)/g) || []).length;
      consolesRemoved += removed;
      modified = true;
    }
    
    // Remover comentários // DEBUG
    content = content.replace(/\/\/ DEBUG:.*\n/g, '');
    
    // Remover comentários // TODO: (opcional)
    // content = content.replace(/\/\/ TODO:.*\n/g, '');
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      filesProcessed++;
      console.log(`✅ Processado: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Erro ao processar ${filePath}:`, error.message);
  }
}

// Função para percorrer diretórios
function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Ignorar node_modules, .next, .git
      if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(file)) {
        walkDir(filePath, callback);
      }
    } else if (stat.isFile()) {
      // Processar apenas arquivos .ts, .tsx, .js, .jsx
      if (/\.(ts|tsx|js|jsx)$/.test(file)) {
        callback(filePath);
      }
    }
  });
}

// Processar diretório src
if (fs.existsSync('src')) {
  console.log('📂 Processando diretório src/...\n');
  walkDir('src', processFile);
}

// Resumo
console.log('\n' + '='.repeat(50));
console.log('📊 RESUMO DA LIMPEZA');
console.log('='.repeat(50));
console.log(`Arquivos processados: ${filesProcessed}`);
console.log(`Console.logs removidos: ${consolesRemoved}`);
console.log('\n✅ Limpeza concluída!\n');

if (filesProcessed > 0) {
  console.log('⚠️  IMPORTANTE: Revise as mudanças antes de commitar!');
  console.log('Execute: git diff\n');
}
