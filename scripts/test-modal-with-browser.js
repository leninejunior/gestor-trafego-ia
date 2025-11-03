const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const fetch = require('node-fetch');

async function testModalWithBrowser() {
  console.log('🚀 TESTANDO MODAL DE AJUSTE MANUAL...\n');
  
  // 1. Verificar se o servidor está rodando
  console.log('1. Verificando servidor...');
  
  let serverRunning = false;
  try {
    const response = await fetch('http://localhost:3000', { timeout: 3000 });
    serverRunning = true;
    console.log('✅ Servidor já está rodando');
  } catch (error) {
    console.log('❌ Servidor não está rodando');
    console.log('\n📋 INSTRUÇÕES:');
    console.log('1. Abra um novo terminal');
    console.log('2. Execute: npm run dev');
    console.log('3. Aguarde aparecer "Ready - started server on 0.0.0.0:3000"');
    console.log('4. Execute este script novamente');
    return;
  }
  
  if (!serverRunning) return;
  
  // 2. Abrir navegador
  console.log('\n2. Abrindo navegador...');
  
  const browser = await puppeteer.launch({ 
    headless: false, 
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1400, height: 900 }
  });
  
  const page = await browser.newPage();
  
  // 3. Navegar para a página
  console.log('3. Navegando para página de subscription management...');
  
  try {
    await page.goto('http://localhost:3000/admin/subscription-management', { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    console.log('✅ Página carregada');
    
    // 4. Aguardar a página carregar completamente
    await page.waitForTimeout(3000);
    
    // 5. Procurar por organizações na página
    console.log('\n4. Procurando organizações...');
    
    const organizations = await page.$$eval('table tbody tr', rows => {
      return rows.map(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
          return {
            name: cells[0]?.textContent?.trim() || 'N/A',
            hasAdjustButton: !!row.querySelector('button:has-text("Ajustar"), button[title*="Ajustar"], button[aria-label*="Ajustar"]')
          };
        }
        return null;
      }).filter(Boolean);
    });
    
    console.log(`📊 Encontradas ${organizations.length} organizações`);
    
    if (organizations.length === 0) {
      console.log('⚠️ Nenhuma organização encontrada na tabela');
      console.log('\n🔍 Verificando conteúdo da página...');
      
      const pageContent = await page.evaluate(() => {
        return {
          title: document.title,
          hasTable: !!document.querySelector('table'),
          hasLoadingText: document.body.textContent.includes('Carregando'),
          hasErrorText: document.body.textContent.includes('Erro'),
          bodyText: document.body.textContent.substring(0, 500)
        };
      });
      
      console.log('📄 Conteúdo da página:', pageContent);
    }
    
    // 6. Procurar botão "Ajustar" de forma mais ampla
    console.log('\n5. Procurando botões "Ajustar"...');
    
    const adjustButtons = await page.$$eval('button', buttons => {
      return buttons.map((btn, index) => ({
        index,
        text: btn.textContent?.trim() || '',
        title: btn.title || '',
        ariaLabel: btn.getAttribute('aria-label') || '',
        className: btn.className || '',
        visible: btn.offsetParent !== null
      })).filter(btn => 
        btn.text.toLowerCase().includes('ajustar') ||
        btn.title.toLowerCase().includes('ajustar') ||
        btn.ariaLabel.toLowerCase().includes('ajustar')
      );
    });
    
    console.log(`🔘 Encontrados ${adjustButtons.length} botões "Ajustar"`);
    
    if (adjustButtons.length > 0) {
      console.log('📋 Botões encontrados:', adjustButtons);
      
      // 7. Clicar no primeiro botão "Ajustar"
      console.log('\n6. Clicando no botão "Ajustar"...');
      
      const buttonSelector = `button:nth-of-type(${adjustButtons[0].index + 1})`;
      await page.click(buttonSelector);
      
      // 8. Aguardar modal aparecer
      console.log('7. Aguardando modal aparecer...');
      
      try {
        await page.waitForSelector('[role="dialog"], .modal, [data-testid="modal"]', { 
          timeout: 5000 
        });
        
        console.log('✅ Modal apareceu!');
        
        // 9. Verificar conteúdo do modal
        const modalContent = await page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"], .modal, [data-testid="modal"]');
          if (!modal) return null;
          
          return {
            title: modal.querySelector('h1, h2, h3, [data-testid="modal-title"]')?.textContent?.trim(),
            hasAdjustmentTypeField: !!modal.querySelector('select, [data-testid="adjustment-type"]'),
            hasReasonField: !!modal.querySelector('textarea, input[name*="reason"], [data-testid="reason"]'),
            hasValueField: !!modal.querySelector('input[type="number"], [data-testid="value"]'),
            hasSaveButton: !!modal.querySelector('button[type="submit"], button:has-text("Salvar")'),
            fullText: modal.textContent?.substring(0, 1000)
          };
        });
        
        console.log('\n📋 CONTEÚDO DO MODAL:');
        console.log('🏷️ Título:', modalContent.title);
        console.log('📝 Campo Tipo de Ajuste:', modalContent.hasAdjustmentTypeField ? '✅' : '❌');
        console.log('💬 Campo Motivo:', modalContent.hasReasonField ? '✅' : '❌');
        console.log('💰 Campo Valor:', modalContent.hasValueField ? '✅' : '❌');
        console.log('💾 Botão Salvar:', modalContent.hasSaveButton ? '✅' : '❌');
        
        if (modalContent.fullText) {
          console.log('\n📄 Texto completo do modal:');
          console.log(modalContent.fullText);
        }
        
        // 10. Verificar se é o formulário correto ou mensagem antiga
        if (modalContent.fullText && modalContent.fullText.includes('será implementada em breve')) {
          console.log('\n❌ MODAL AINDA MOSTRA MENSAGEM ANTIGA!');
          console.log('🔧 Soluções:');
          console.log('1. Pressione Ctrl+F5 para forçar refresh');
          console.log('2. Ou feche o navegador e execute: Remove-Item -Recurse -Force .next');
          console.log('3. Depois reinicie: npm run dev');
        } else if (modalContent.hasAdjustmentTypeField && modalContent.hasReasonField) {
          console.log('\n🎉 SUCESSO! Modal mostra o formulário completo!');
          console.log('✅ Funcionalidade implementada corretamente');
        } else {
          console.log('\n⚠️ Modal abriu mas pode estar incompleto');
        }
        
      } catch (error) {
        console.log('❌ Modal não apareceu dentro do tempo limite');
        console.log('Erro:', error.message);
      }
      
    } else {
      console.log('❌ Nenhum botão "Ajustar" encontrado');
      
      // Verificar se há botões na página
      const allButtons = await page.$$eval('button', buttons => {
        return buttons.map(btn => ({
          text: btn.textContent?.trim() || '',
          visible: btn.offsetParent !== null
        })).filter(btn => btn.visible);
      });
      
      console.log('\n🔘 Todos os botões visíveis na página:');
      allButtons.forEach((btn, i) => {
        console.log(`${i + 1}. "${btn.text}"`);
      });
    }
    
    console.log('\n🔍 Navegador mantido aberto para inspeção manual...');
    console.log('Pressione Ctrl+C para fechar');
    
    // Manter navegador aberto
    process.on('SIGINT', async () => {
      console.log('\n🔄 Fechando navegador...');
      await browser.close();
      process.exit(0);
    });
    
    // Aguardar indefinidamente
    await new Promise(() => {});
    
  } catch (error) {
    console.log('❌ Erro ao navegar:', error.message);
    await browser.close();
  }
}

testModalWithBrowser().catch(console.error);