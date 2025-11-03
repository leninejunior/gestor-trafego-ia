const puppeteer = require('puppeteer');

async function debugModalReal() {
  let browser;
  try {
    console.log('🔍 TESTANDO MODAL NO NAVEGADOR REAL...\\n');
    
    // Abrir navegador
    browser = await puppeteer.launch({ 
      headless: false, 
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Navegar para a página
    console.log('1. Navegando para a página...');
    await page.goto('http://localhost:3000/admin/subscription-management', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    console.log('✅ Página carregada');
    
    // Aguardar a página carregar completamente
    await page.waitForTimeout(3000);
    
    // Verificar se há organizações
    console.log('\\n2. Verificando organizações...');
    const organizations = await page.$$('[data-testid=\"organization-card\"], .organization-card, button:has-text(\"Ajustar\")');
    console.log(`Organizações encontradas: ${organizations.length}`);
    
    if (organizations.length === 0) {
      // Tentar encontrar botões \"Ajustar\" de outra forma
      const adjustButtons = await page.$$('button');
      const adjustButtonsText = [];
      
      for (const button of adjustButtons) {
        const text = await page.evaluate(el => el.textContent, button);
        if (text && text.includes('Ajustar')) {
          adjustButtonsText.push(text);
        }
      }
      
      console.log(`Botões \"Ajustar\" encontrados: ${adjustButtonsText.length}`);
      console.log('Textos dos botões:', adjustButtonsText);
    }
    
    // Procurar por qualquer botão que contenha \"Ajustar\"
    console.log('\\n3. Procurando botão \"Ajustar\"...');
    
    try {
      await page.waitForSelector('button', { timeout: 5000 });
      
      // Clicar no primeiro botão \"Ajustar\" encontrado
      const adjustButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => btn.textContent && btn.textContent.includes('Ajustar'));
      });
      
      if (adjustButton.asElement()) {
        console.log('✅ Botão \"Ajustar\" encontrado!');
        
        // Clicar no botão
        console.log('\\n4. Clicando no botão \"Ajustar\"...');
        await adjustButton.asElement().click();
        
        // Aguardar modal aparecer
        await page.waitForTimeout(2000);
        
        // Verificar se o modal abriu
        console.log('\\n5. Verificando modal...');
        
        const modalContent = await page.evaluate(() => {
          // Procurar por diferentes seletores de modal
          const selectors = [
            '[role=\"dialog\"]',
            '.modal',
            '[data-testid=\"modal\"]',
            'div[class*=\"dialog\"]',
            'div[class*=\"modal\"]'
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              return {
                found: true,
                selector: selector,
                content: element.textContent,
                innerHTML: element.innerHTML.substring(0, 500)
              };
            }
          }
          
          return { found: false };
        });
        
        if (modalContent.found) {
          console.log('✅ MODAL ENCONTRADO!');
          console.log(`Seletor: ${modalContent.selector}`);
          console.log(`Conteúdo: ${modalContent.content.substring(0, 200)}...`);
          
          // Verificar se ainda tem a mensagem placeholder
          if (modalContent.content.includes('será implementada em breve')) {
            console.log('❌ PROBLEMA: Modal ainda mostra mensagem placeholder!');
            console.log('O arquivo não foi atualizado corretamente no navegador.');
          } else if (modalContent.content.includes('Tipo de Ajuste')) {
            console.log('✅ SUCESSO: Modal mostra formulário completo!');
          } else {
            console.log('⚠️ Modal tem conteúdo inesperado');
          }
        } else {
          console.log('❌ Modal não encontrado');
        }
        
        // Fazer screenshot
        await page.screenshot({ path: 'modal-debug.png', fullPage: true });
        console.log('📸 Screenshot salvo como modal-debug.png');
        
      } else {
        console.log('❌ Botão \"Ajustar\" não encontrado');
      }
      
    } catch (error) {
      console.log('❌ Erro ao procurar botão:', error.message);
    }
    
    // Manter navegador aberto para inspeção manual
    console.log('\\n🔍 Navegador mantido aberto para inspeção manual...');
    console.log('Pressione Ctrl+C para fechar');
    
    // Aguardar indefinidamente
    await new Promise(() => {});
    
  } catch (error) {
    console.log('❌ Erro:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

debugModalReal();