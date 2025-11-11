@echo off
echo ========================================
echo Reiniciando servidor Next.js
echo ========================================
echo.

echo [1/3] Parando processos Node.js...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/3] Limpando cache do Next.js...
if exist .next rmdir /s /q .next
echo Cache limpo!

echo [3/3] Iniciando servidor...
echo.
echo Servidor iniciando em http://localhost:3000
echo Pressione Ctrl+C para parar
echo.

npm run dev
