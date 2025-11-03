// Script para testar o modal automaticamente
console.log('🎯 TESTANDO MODAL DE AJUSTE MANUAL AUTOMATICAMENTE...\n');

// Função para aguardar elemento aparecer
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function check() {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Elemento ${selector} não encontrado em ${timeout}ms`));
      } else {
        setTimeout(check, 100);
      }
    }
    
    check();
  });
}

// Função principal de teste
async function testModal() {
  try {
    console.log('1. Verificando se estamos na página correta...');
    
    if (!window.location.href.includes('subscription-management')) {
      console.log('❌ Não estamos na página de subscription management');
      console.log('📍 URL atual:', window.location.href);
      console.log('💡 Navegue para: http://localhost:3000/admin/subscription-management');
      return;
    }
    
    console.log('✅ Estamos na página correta');
    
    // 2. Aguardar a página carregar completamente
    console.log('\n2. Aguardando página carregar...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. Procurar por organizações na tabela
    console.log('\n3. Procurando organizações na tabela...');
    
    const tableRows = document.querySelectorAll('table tbody tr');
    console.log(`📊 Encontradas ${tableRows.length} linhas na tabela`);
    
    if (tableRows.length === 0) {
      console.log('⚠️ Nenhuma organização encontrada na tabela');
      console.log('🔍 Verificando se há mensagem de carregamento...');
      
      const loadingText = document.body.textContent;
      if (loadingText.includes('Carregando') || loadingText.includes('Loading')) {
        console.log('⏳ Página ainda está carregando, aguarde...');
      } else {
        console.log('❌ Tabela vazia ou não encontrada');
      }
      return;
    }
    
    // 4. Procurar botões "Ajustar"
    console.log('\n4. Procurando botões "Ajustar"...');
    
    const adjustButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
      btn.textContent.toLowerCase().includes('ajustar') ||
      btn.title?.toLowerCase().includes('ajustar') ||
      btn.getAttribute('aria-label')?.toLowerCase().includes('ajustar')
    );
    
    console.log(`🔘 Encontrados ${adjustButtons.length} botões "Ajustar"`);
    
    if (adjustButtons.length === 0) {
      console.log('❌ Nenhum botão "Ajustar" encontrado');
      
      // Listar todos os botões visíveis
      const allButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
        btn.offsetParent !== null
      );
      
      console.log('\n🔘 Todos os botões visíveis na página:');
      allButtons.forEach((btn, i) => {
        console.log(`${i + 1}. "${btn.textContent.trim()}" (${btn.className})`);
      });
      return;
    }
    
    // 5. Clicar no primeiro botão "Ajustar"
    console.log('\n5. Clicando no primeiro botão "Ajustar"...');
    
    const firstButton = adjustButtons[0];
    console.log(`🎯 Clicando em: "${firstButton.textContent.trim()}"`);
    
    firstButton.click();
    
    // 6. Aguardar modal aparecer
    console.log('\n6. Aguardando modal aparecer...');
    
    try {
      const modal = await waitForElement('[role="dialog"], .modal, [data-testid="modal"]', 5000);
      console.log('✅ Modal apareceu!');
      
      // 7. Analisar conteúdo do modal
      console.log('\n7. Analisando conteúdo do modal...');
      
      const modalAnalysis = {
        title: modal.querySelector('h1, h2, h3, [data-testid="modal-title"]')?.textContent?.trim(),
        hasAdjustmentType: !!modal.querySelector('select, [data-testid="adjustment-type"], [name*="type"]'),
        hasReasonField: !!modal.querySelector('textarea, input[name*="reason"], [data-testid="reason"]'),
        hasValueField: !!modal.querySelector('input[type="number"], [data-testid="value"], [name*="value"]'),
        hasSaveButton: !!modal.querySelector('button[type="submit"], button:has-text("Salvar"), [data-testid="save"]'),
        hasCancelButton: !!modal.querySelector('button[type="button"]:has-text("Cancelar"), [data-testid="cancel"]'),
        fullText: modal.textContent?.substring(0, 500)
      };
      
      console.log('\n📋 ANÁLISE DO MODAL:');
      console.log('🏷️ Título:', modalAnalysis.title || 'Não encontrado');
      console.log('📝 Campo Tipo de Ajuste:', modalAnalysis.hasAdjustmentType ? '✅' : '❌');
      console.log('💬 Campo Motivo:', modalAnalysis.hasReasonField ? '✅' : '❌');
      console.log('💰 Campo Valor:', modalAnalysis.hasValueField ? '✅' : '❌');
      console.log('💾 Botão Salvar:', modalAnalysis.hasSaveButton ? '✅' : '❌');
      console.log('❌ Botão Cancelar:', modalAnalysis.hasCancelButton ? '✅' : '❌');
      
      // 8. Verificar se é o formulário correto
      console.log('\n8. Verificando implementação...');
      
      if (modalAnalysis.fullText && modalAnalysis.fullText.includes('será implementada em breve')) {
        console.log('❌ MODAL AINDA MOSTRA MENSAGEM ANTIGA!');
        console.log('\n🔧 SOLUÇÕES:');
        console.log('1. Pressione Ctrl+F5 para forçar refresh');
        console.log('2. Ou execute: Remove-Item -Recurse -Force .next');
        console.log('3. Depois reinicie: npm run dev');
      } else if (modalAnalysis.hasAdjustmentType && modalAnalysis.hasReasonField) {
        console.log('🎉 SUCESSO! Modal mostra o formulário completo!');
        console.log('✅ Funcionalidade implementada corretamente');
        
        // 9. Testar preenchimento do formulário (opcional)
        console.log('\n9. Testando preenchimento do formulário...');
        
        try {
          const typeSelect = modal.querySelector('select, [data-testid="adjustment-type"]');
          const reasonField = modal.querySelector('textarea, [name*="reason"]');
          
          if (typeSelect && reasonField) {
            console.log('📝 Preenchendo campos de teste...');
            
            // Selecionar primeiro tipo
            if (typeSelect.options && typeSelect.options.length > 1) {
              typeSelect.selectedIndex = 1;
              typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('✅ Tipo selecionado:', typeSelect.options[1].text);
            }
            
            // Preencher motivo
            reasonField.value = 'Teste automatizado do modal';
            reasonField.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('✅ Motivo preenchido');
            
            console.log('🎯 Formulário preenchido com sucesso!');
          }
        } catch (error) {
          console.log('⚠️ Erro ao preencher formulário:', error.message);
        }
        
      } else {
        console.log('⚠️ Modal abriu mas pode estar incompleto');
        console.log('📄 Conteúdo do modal:');
        console.log(modalAnalysis.fullText);
      }
      
      // 10. Manter modal aberto para inspeção
      console.log('\n🔍 Modal mantido aberto para inspeção manual...');
      console.log('💡 Você pode fechar o modal clicando em "Cancelar" ou fora dele');
      
    } catch (error) {
      console.log('❌ Modal não apareceu:', error.message);
      
      // Verificar se há algum erro na página
      console.log('\n🔍 Verificando erros na página...');
      
      const errors = Array.from(document.querySelectorAll('[class*="error"], .alert-error, .text-red'));
      if (errors.length > 0) {
        console.log('⚠️ Erros encontrados na página:');
        errors.forEach((error, i) => {
          console.log(`${i + 1}. ${error.textContent.trim()}`);
        });
      }
    }
    
  } catch (error) {
    console.log('❌ Erro durante o teste:', error.message);
  }
}

// Executar teste
testModal();

// Adicionar instruções para o usuário
console.log('\n📋 INSTRUÇÕES:');
console.log('1. Este script deve ser executado no console do navegador');
console.log('2. Abra http://localhost:3000/admin/subscription-management');
console.log('3. Pressione F12 para abrir DevTools');
console.log('4. Cole este script no console e pressione Enter');
console.log('5. O script testará automaticamente o modal');