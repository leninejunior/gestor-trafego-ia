const https = require('https');
const http = require('http');

async function testModalSimple() {
  console.log('🔍 TESTANDO MODAL DE AJUSTE MANUAL...\n');
  
  try {
    // 1. Verificar se o servidor está rodando
    console.log('1. Verificando servidor...');
    
    const html = await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:3000/admin/subscription-management', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ Servidor ativo - Status:', res.statusCode);
            resolve(data);
          } else {
            reject(new Error(`Status: ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Timeout')));
    });
      
      // 2. Verificar se a página contém o componente atualizado
      console.log('\n2. Analisando conteúdo da página...');
      
      const checks = {
        hasSubscriptionManagement: html.includes('Gerenciamento Manual de Assinaturas') || html.includes('subscription-management'),
        hasAdjustmentForm: html.includes('AdjustmentForm') || html.includes('Tipo de Ajuste'),
        hasOldMessage: html.includes('será implementada em breve'),
        hasTable: html.includes('<table') || html.includes('tbody'),
        hasReactComponents: html.includes('__NEXT_DATA__'),
        pageTitle: html.match(/<title[^>]*>([^<]+)<\/title>/)?.[1] || 'N/A'
      };
      
      console.log('📄 Título da página:', checks.pageTitle);
      console.log('🏗️ Componentes React:', checks.hasReactComponents ? '✅' : '❌');
      console.log('📋 Gerenciamento de Assinaturas:', checks.hasSubscriptionManagement ? '✅' : '❌');
      console.log('📝 Formulário de Ajuste:', checks.hasAdjustmentForm ? '✅' : '❌');
      console.log('📊 Tabela presente:', checks.hasTable ? '✅' : '❌');
      console.log('⚠️ Mensagem antiga:', checks.hasOldMessage ? '❌ SIM' : '✅ NÃO');
      
      // 3. Verificar se há dados do Next.js
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          console.log('\n3. Dados do Next.js encontrados:');
          console.log('📦 Página:', nextData.page || 'N/A');
          console.log('🔧 Build ID:', nextData.buildId ? 'Presente' : 'Ausente');
        } catch (e) {
          console.log('\n3. Erro ao analisar dados do Next.js');
        }
      }
      
      // 4. Procurar por elementos específicos do modal
      console.log('\n4. Procurando elementos do modal...');
      
      const modalElements = {
        dialogRole: html.includes('role="dialog"'),
        adjustButton: html.includes('Ajustar') || html.includes('ajustar'),
        selectElement: html.includes('<select') || html.includes('Select'),
        textareaElement: html.includes('<textarea') || html.includes('textarea'),
        formElement: html.includes('<form') || html.includes('onSubmit')
      };
      
      console.log('🎭 Role dialog:', modalElements.dialogRole ? '✅' : '❌');
      console.log('🔘 Botão Ajustar:', modalElements.adjustButton ? '✅' : '❌');
      console.log('📝 Select/Dropdown:', modalElements.selectElement ? '✅' : '❌');
      console.log('💬 Textarea:', modalElements.textareaElement ? '✅' : '❌');
      console.log('📋 Formulário:', modalElements.formElement ? '✅' : '❌');
      
      // 5. Resultado final
      console.log('\n🎯 RESULTADO:');
      
      if (checks.hasOldMessage) {
        console.log('❌ PÁGINA AINDA MOSTRA MENSAGEM ANTIGA!');
        console.log('\n🔧 Soluções:');
        console.log('1. Limpe o cache: Remove-Item -Recurse -Force .next');
        console.log('2. Reinicie o servidor: npm run dev');
        console.log('3. Force refresh no navegador: Ctrl+F5');
      } else if (checks.hasAdjustmentForm && modalElements.adjustButton) {
        console.log('🎉 SUCESSO! Página contém o formulário atualizado!');
        console.log('✅ Modal de ajuste implementado corretamente');
      } else if (checks.hasSubscriptionManagement) {
        console.log('⚠️ Página carregou mas pode estar incompleta');
        console.log('💡 Tente acessar manualmente: http://localhost:3000/admin/subscription-management');
      } else {
        console.log('❌ Página não contém o componente esperado');
      }
      
      // 6. Instruções para teste manual
      console.log('\n📋 TESTE MANUAL:');
      console.log('1. Abra: http://localhost:3000/admin/subscription-management');
      console.log('2. Procure por organizações na tabela');
      console.log('3. Clique no botão "Ajustar" de qualquer organização');
      console.log('4. Verifique se o modal abre com:');
      console.log('   - Dropdown "Tipo de Ajuste"');
      console.log('   - Campo "Motivo"');
      console.log('   - Outros campos do formulário');
      

    
  } catch (error) {
    console.log('❌ Erro:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n📋 SERVIDOR NÃO ESTÁ RODANDO!');
      console.log('1. Abra um terminal');
      console.log('2. Execute: npm run dev');
      console.log('3. Aguarde aparecer "Ready - started server on 0.0.0.0:3000"');
      console.log('4. Execute este script novamente');
    }
  }
}

testModalSimple().catch(console.error);