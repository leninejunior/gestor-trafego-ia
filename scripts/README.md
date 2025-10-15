# 📁 Scripts do Sistema

Este diretório contém scripts essenciais para gerenciar o sistema.

## 🚀 Scripts Principais

### `restart-system.bat`
Script principal para reinicialização completa do sistema.
```bash
npm run restart
```
**Funcionalidades:**
- Mata processos Node.js existentes
- Limpa cache do Next.js
- Verifica dependências
- Instala dependências se necessário
- Inicia servidor de desenvolvimento

### `quick-restart.bat`
Script para reinicialização rápida (sem verificações).
```bash
npm run quick-restart
```
**Funcionalidades:**
- Mata processos rapidamente
- Limpa cache básico
- Inicia servidor imediatamente

## 🔧 Scripts Utilitários

### `check-env.js`
Verificação de variáveis de ambiente essenciais.
```bash
npm run check-env
```
**Verifica:**
- Variáveis do Supabase
- Configurações da Meta API
- URLs da aplicação

### `test-system.js`
Teste completo do sistema e validação de arquivos.
```bash
npm run test-system
```
**Funcionalidades:**
- Valida estrutura de arquivos
- Testa sintaxe de componentes
- Verifica dependências
- Relatório completo de status

## 📊 Scripts de Banco de Dados

### `apply-advanced-features-schema.js`
Aplicação do schema completo de funcionalidades avançadas.
```bash
npm run apply-schema
```
**Aplica:**
- Schema de funcionalidades avançadas
- Tabelas de push notifications
- Workflows e automações
- Sistema de monitoramento
- APIs públicas

## 📝 Uso Recomendado

### Desenvolvimento Diário:
```bash
npm run quick-restart  # Reinício rápido
```

### Problemas ou Primeira Instalação:
```bash
npm run restart        # Reinício completo com verificações
```

### Verificar Sistema:
```bash
npm run check-env      # Verificar configurações
npm run test-system    # Teste completo
```

### Aplicar Schema:
```bash
npm run apply-schema   # Aplicar schema do banco
```

## ⚠️ Notas Importantes

- Scripts funcionam no Windows (cmd/PowerShell)
- Sempre execute a partir da raiz do projeto
- Use `quick-restart` para desenvolvimento diário
- Use `restart` quando houver problemas
- Mantenha o `.env` configurado corretamente

## 🗂️ Estrutura Atual

```
scripts/
├── restart-system.bat      # Reinício completo
├── quick-restart.bat       # Reinício rápido  
├── check-env.js           # Verificar .env
├── test-system.js         # Teste do sistema
├── apply-advanced-features-schema.js  # Schema DB
└── README.md              # Esta documentação
```