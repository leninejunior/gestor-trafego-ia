@echo off
echo ========================================
echo    CORRIGINDO ACESSO ADMIN
echo ========================================
echo.

echo 1. Verificando se o servidor esta rodando...
curl -s http://localhost:3000/api/user/info > nul
if %errorlevel% neq 0 (
    echo ❌ Servidor nao esta rodando. Execute: pnpm dev
    pause
    exit /b 1
)
echo ✅ Servidor rodando

echo.
echo 2. Criando tabela admin_users...
curl -X POST http://localhost:3000/api/debug/create-admin-table
echo.

echo 3. Configurando usuario atual como admin...
curl -X POST http://localhost:3000/api/debug/setup-admin
echo.

echo 4. Verificando perfil do usuario...
curl http://localhost:3000/api/debug/user-profile
echo.

echo ========================================
echo    TESTE CONCLUIDO
echo ========================================
echo.
echo Agora tente acessar: http://localhost:3000/admin/plans
echo E editar um plano para verificar se o erro foi corrigido.
echo.
pause