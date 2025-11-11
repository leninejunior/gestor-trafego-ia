@echo off
cls
echo.
echo ========================================
echo   CORRECAO RAPIDA - Meta save-selected
echo ========================================
echo.
echo Este script vai:
echo  1. Parar o servidor Node.js
echo  2. Limpar cache do Next.js
echo  3. Reiniciar o servidor
echo.
echo Pressione qualquer tecla para continuar...
pause >nul

echo.
echo [1/3] Parando servidor...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo      OK - Servidor parado
) else (
    echo      OK - Nenhum servidor rodando
)
timeout /t 2 /nobreak >nul

echo.
echo [2/3] Limpando cache...
if exist .next (
    rmdir /s /q .next
    echo      OK - Cache limpo
) else (
    echo      OK - Cache ja estava limpo
)

echo.
echo [3/3] Iniciando servidor...
echo.
echo ========================================
echo   Servidor iniciando...
echo   URL: http://localhost:3000
echo   Pressione Ctrl+C para parar
echo ========================================
echo.

npm run dev
