@echo off
echo.
echo ========================================
echo   MIGRAÇÕES DO SISTEMA DE CHECKOUT
echo ========================================
echo.
echo Este script vai te guiar na execução das
echo migrações do sistema de checkout no Supabase
echo.
echo Pressione qualquer tecla para continuar...
pause >nul

echo.
echo Executando guia de migração...
echo.

node scripts/execute-checkout-migrations-simple.js

echo.
echo ========================================
echo.
echo 📋 PRÓXIMOS PASSOS:
echo.
echo 1. Abra o Supabase Dashboard
echo 2. Vá para SQL Editor  
echo 3. Execute os 6 arquivos na ordem mostrada acima
echo 4. Cada arquivo está em database/checkout-migration-step-X.sql
echo.
echo ========================================
echo.
pause