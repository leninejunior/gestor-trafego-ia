# Scripts do Projeto

Este diretório contém scripts utilitários para o projeto Ads Manager.

## Scripts Principais

### Desenvolvimento
- `restart.bat` - Reinicia o servidor de desenvolvimento (RECOMENDADO)
- `start-dev.bat` - Inicia o servidor rapidamente
- `quick-restart.bat` - Reinicialização rápida (alternativa)

### Banco de Dados
- `apply-advanced-features-schema.js` - Aplica schema de funcionalidades avançadas
- `apply-landing-schema.js` - Aplica schema da landing page
- `apply-payments-schema.js` - Aplica schema de pagamentos
- `apply-subscription-schema.js` - Aplica schema de assinaturas
- `apply-user-management-schema.js` - Aplica schema de gerenciamento de usuários

### Utilitários
- `check-env.js` - Verifica variáveis de ambiente
- `test-system.js` - Testa o sistema completo
- `pre-deploy-check.js` - Verificações pré-deploy
- `clean-for-production.js` - Limpa arquivos para produção

## Como Usar

### Reiniciar Sistema (PRINCIPAL)
```bash
npm run restart
# ou
scripts/restart.bat
```

### Desenvolvimento Rápido
```bash
npm run dev-start
# ou
scripts/start-dev.bat
```

### Verificar Ambiente
```bash
npm run check-env
# ou
node scripts/check-env.js
```

## Notas

- Use `npm run restart` para reiniciar o sistema
- Scripts `.bat` são otimizados para Windows
- Scripts `.js` são executados com Node.js
- Sempre execute a partir da raiz do projeto
- Scripts PowerShell foram removidos por problemas de compatibilidade