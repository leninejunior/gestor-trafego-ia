@echo off
echo ========================================
echo VALIDANDO SEGURANCA RLS DO CHECKOUT
echo ========================================
echo.

echo Executando validacao de seguranca das politicas RLS...
node scripts/validate-checkout-rls-security.js

echo.
echo ========================================
echo VALIDACAO CONCLUIDA
echo ========================================
pause