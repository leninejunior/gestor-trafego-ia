@echo off
echo ========================================
echo Atualizando tokens no Vercel
echo ========================================
echo.

echo Atualizando META_ACCESS_TOKEN...
vercel env rm META_ACCESS_TOKEN production -y
vercel env add META_ACCESS_TOKEN production

echo.
echo ========================================
echo Tokens atualizados com sucesso!
echo ========================================
echo.
echo Agora execute: vercel --prod
echo.
pause
