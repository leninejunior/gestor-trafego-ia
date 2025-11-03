const { default: fetch } = require('node-fetch');

async function forceBrowserRefresh() {
  try {
    console.log('🔄 FORÇANDO REFRESH COMPLETO DO NAVEGADOR...\\n');
    
    // 1. Verificar se o servidor está rodando
    console.log('1. Verificando servidor...');
    const serverResponse = await fetch('http://localhost:3000/admin/subscription-management');
    console.log(`✅ Servidor: Status ${serverResponse.status}`);
    
    // 2. Verificar conteúdo atual do arquivo
    console.log('\\n2. Verificando arquivo atual...');
    const fs = require('fs');
    const filePath = 'src/components/admin/subscription-manual-management.tsx';
    
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes('será implementada em breve')) {
        console.log('❌ PROBLEMA ENCONTRADO: Arquivo ainda tem mensagem placeholder!');
        console.log('O arquivo não foi salvo corretamente.');
        
        // Mostrar as linhas problemáticas
        const lines = content.split('\\n');
        lines.forEach((line, index) => {
          if (line.includes('será implementada em breve')) {
            console.log(`Linha ${index + 1}: ${line.trim()}`);
          }
        });
        
        return;
      } else if (content.includes('AdjustmentForm')) {
        console.log('✅ Arquivo contém AdjustmentForm - implementação correta');
      } else {
        console.log('⚠️ Arquivo não contém AdjustmentForm nem placeholder');
      }
    } else {
      console.log('❌ Arquivo não encontrado!');
      return;
    }
    
    // 3. Verificar se Next.js detectou as mudanças
    console.log('\\n3. Verificando se Next.js recompilou...');
    
    // Fazer uma requisição para forçar recompilação
    try {
      const pageResponse = await fetch('http://localhost:3000/admin/subscription-management', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const html = await pageResponse.text();
      
      if (html.includes('AdjustmentForm') || html.includes('Tipo de Ajuste')) {
        console.log('✅ Next.js compilou a versão atualizada');
      } else if (html.includes('será implementada em breve')) {
        console.log('❌ Next.js ainda serve a versão antiga');
        console.log('Tentando forçar recompilação...');
        
        // Tentar tocar o arquivo para forçar recompilação
        const now = new Date();
        fs.utimesSync(filePath, now, now);
        console.log('📝 Arquivo \"tocado\" para forçar recompilação');
        
        // Aguardar um pouco
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } else {
        console.log('⚠️ HTML não contém marcadores esperados');
      }
    } catch (error) {
      console.log('❌ Erro ao verificar HTML:', error.message);
    }
    
    // 4. Instruções para o usuário
    console.log('\\n📋 INSTRUÇÕES PARA RESOLVER:');
    console.log('1. Abra o navegador em: http://localhost:3000/admin/subscription-management');
    console.log('2. Pressione Ctrl+F5 (ou Cmd+Shift+R no Mac) para refresh forçado');
    console.log('3. Abra DevTools (F12) e vá na aba Network');
    console.log('4. Marque \"Disable cache\" e recarregue a página');
    console.log('5. Clique em \"Ajustar\" em qualquer organização');
    console.log('6. Verifique se o modal mostra o formulário completo');
    
    console.log('\\n🔧 Se ainda não funcionar:');
    console.log('1. Pare o servidor Next.js (Ctrl+C)');
    console.log('2. Delete a pasta .next: rmdir /s .next');
    console.log('3. Reinicie: npm run dev');
    
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }
}

forceBrowserRefresh();