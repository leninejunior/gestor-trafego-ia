# Scripts do Projeto

Este diretório contém scripts utilitários para o projeto Ads Manager.

## Scripts Principais

### Desenvolvimento
- `../start.bat` - Comando simples para iniciar (RECOMENDADO)
- `dev-clean.bat` - Reinicia com limpeza completa
- `start-dev.bat` - Inicia o servidor rapidamente

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

### Opção 1: Comando Simples (RECOMENDADO)
```bash
# Na raiz do projeto
start.bat
```

### Opção 2: Com Limpeza
```bash
# Na raiz do projeto
./scripts/dev-clean.bat
```

### Opção 3: Manual
```bash
# Mata processos e inicia
taskkill /f /im node.exe && pnpm dev
```

### Verificar Ambiente
```bash
node scripts/check-env.js
```

## Notas

- Use `start.bat` na raiz para iniciar rapidamente
- Scripts `.bat` são otimizados para Windows
- Scripts `.js` são executados com Node.js
- Sempre execute a partir da raiz do projeto
- Scripts problemáticos foram removidos