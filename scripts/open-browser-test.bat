@echo off
echo 🚀 ABRINDO NAVEGADOR PARA TESTE DO MODAL...
echo.
echo 📋 INSTRUÇÕES:
echo 1. O navegador abrirá automaticamente
echo 2. Navegue para: http://localhost:3000/admin/subscription-management
echo 3. Procure por organizações na tabela
echo 4. Clique no botão "Ajustar" de qualquer organização
echo 5. Verifique se o modal abre com o formulário completo
echo.
echo ⏳ Abrindo navegador em 3 segundos...
timeout /t 3 /nobreak >nul

start "" "http://localhost:3000/admin/subscription-management"

echo ✅ Navegador aberto!
echo 💡 Se a página não carregar, verifique se o servidor está rodando com: npm run dev
pause