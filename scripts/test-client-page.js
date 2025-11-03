const puppeteer = require('puppeteer');

async function testClientPage() {
    console.log('🌐 Testando página do cliente...\n');
    
    const browser = await puppeteer.launch({ 
        headless: false, 
        defaultViewport: null,
        args: ['--start-maximized']
    });
    
    try {
        const page = await browser.newPage();
        
        // Interceptar requisições para debug
        page.on('response', response => {
            const url = response.url();
            if (url.includes('/api/')) {
                console.log(`📡 API Response: ${response.status()} - ${url}`);
            }
        });
        
        page.on('console', msg => {
            console.log(`🖥️ Console: ${msg.text()}`);
        });
        
        console.log('1. Navegando para a página do cliente...');
        await page.goto('http://localhost:3000/dashboard/clients/e0ae65bf-1f97-474a-988e-a5418ab28e77');
        
        console.log('2. Aguardando carregamento...');
        await page.waitForTimeout(3000);
        
        console.log('3. Verificando se há conexões Meta visíveis...');
        
        // Procurar por elementos que indiquem conexões Meta
        const metaElements = await page.$$eval('[data-testid*="meta"], [class*="meta"], [class*="facebook"]', 
            elements => elements.map(el => ({
                tag: el.tagName,
                class: el.className,
                text: el.textContent?.substring(0, 100)
            }))
        );
        
        console.log('📊 Elementos Meta encontrados:', metaElements.length);
        metaElements.forEach((el, i) => {
            console.log(`  ${i + 1}. ${el.tag} - ${el.class} - "${el.text}"`);
        });
        
        // Procurar por texto relacionado a Meta/Facebook
        const pageText = await page.evaluate(() => document.body.textContent);
        const hasMetaText = pageText.includes('Meta') || pageText.includes('Facebook') || pageText.includes('BM Coan');
        
        console.log('📝 Página contém texto Meta/Facebook:', hasMetaText);
        
        if (hasMetaText) {
            console.log('✅ Conexões Meta parecem estar sendo exibidas!');
        } else {
            console.log('⚠️ Não foi encontrado texto relacionado ao Meta na página');
        }
        
        console.log('\n4. Aguardando 10 segundos para inspeção manual...');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await browser.close();
    }
}

// Verificar se puppeteer está instalado
try {
    require('puppeteer');
    testClientPage().catch(console.error);
} catch (error) {
    console.log('❌ Puppeteer não está instalado. Instalando...');
    console.log('Execute: npm install puppeteer');
    console.log('Ou acesse manualmente: http://localhost:3000/dashboard/clients/e0ae65bf-1f97-474a-988e-a5418ab28e77');
}