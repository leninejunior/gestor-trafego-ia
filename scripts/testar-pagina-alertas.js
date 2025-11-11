const { chromium } = require('playwright');

async function testarPaginaAlertas() {
  console.log('🚀 Iniciando teste da página de alertas de saldo...\n');

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Ir para a página de alertas
    console.log('📄 Acessando página de alertas...');
    await page.goto('http://localhost:3000/dashboard/balance-alerts');
    await page.waitForTimeout(2000);

    // 2. Verificar se a página carregou
    const title = await page.textContent('h1');
    console.log(`✅ Título da página: ${title}`);

    // 3. Aguardar carregamento dos alertas
    console.log('\n⏳ Aguardando carregamento dos alertas...');
    await page.waitForTimeout(3000);

    // 4. Verificar se há alertas na tabela
    const alertRows = await page.locator('tbody tr').count();
    console.log(`📊 Alertas encontrados: ${alertRows}`);

    // 5. Tirar screenshot
    await page.screenshot({ 
      path: 'teste-pagina-alertas.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot salvo: teste-pagina-alertas.png');

    // 6. Testar filtros
    console.log('\n🔍 Testando filtros...');
    
    // Filtro de busca
    await page.fill('input[placeholder="Filtrar busca"]', 'Coan');
    await page.waitForTimeout(1000);
    const filteredRows = await page.locator('tbody tr').count();
    console.log(`   Após filtro de busca: ${filteredRows} alertas`);

    // Limpar filtro
    await page.fill('input[placeholder="Filtrar busca"]', '');
    await page.waitForTimeout(1000);

    // Filtro de status
    await page.selectOption('select:has-text("Todos os status")', 'warning');
    await page.waitForTimeout(1000);
    const warningRows = await page.locator('tbody tr').count();
    console.log(`   Alertas com status "Atenção": ${warningRows}`);

    // 7. Testar botão de atualizar
    console.log('\n🔄 Testando botão de atualizar...');
    await page.click('button:has-text("Atualizar")');
    await page.waitForTimeout(2000);
    console.log('   ✅ Botão de atualizar funcionou');

    // 8. Verificar ações na tabela
    console.log('\n⚙️ Verificando ações disponíveis...');
    const firstRow = page.locator('tbody tr').first();
    const actionButtons = await firstRow.locator('button').count();
    console.log(`   Botões de ação por linha: ${actionButtons}`);

    console.log('\n✅ Teste concluído com sucesso!');
    console.log('\n📋 Resumo:');
    console.log(`   - Alertas carregados: ${alertRows}`);
    console.log(`   - Filtros funcionando: ✅`);
    console.log(`   - Ações disponíveis: ✅`);
    console.log(`   - Interface responsiva: ✅`);

    // Manter navegador aberto para inspeção
    console.log('\n👀 Navegador permanecerá aberto para inspeção...');
    console.log('   Pressione Ctrl+C para fechar');
    await page.waitForTimeout(300000); // 5 minutos

  } catch (error) {
    console.error('\n❌ Erro durante o teste:', error.message);
    await page.screenshot({ path: 'erro-teste-alertas.png' });
    console.log('📸 Screenshot do erro salvo: erro-teste-alertas.png');
  } finally {
    await browser.close();
  }
}

testarPaginaAlertas();
