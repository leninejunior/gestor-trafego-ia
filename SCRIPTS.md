# 🔧 Scripts de Automação

Sistema completo de scripts para gerenciar o desenvolvimento e produção.

## 🚀 Comandos Rápidos

```bash
# Configuração inicial (primeira vez)
pnpm run setup

# Verificar saúde do sistema
pnpm run check

# Reinicialização rápida
pnpm run quick-restart

# Reinicialização completa
pnpm run restart

# Monitoramento contínuo
pnpm run monitor

# Monitoramento com auto-restart
pnpm run monitor-auto
```

## 📁 Estrutura dos Scripts

```
scripts/
├── setup.ps1              # Configuração inicial
├── restart-system.ps1     # Reinicialização completa
├── quick-restart.bat      # Reinicialização rápida
├── system-check.ps1       # Verificação do sistema
├── monitor.ps1            # Monitoramento contínuo
└── README.md              # Documentação detalhada
```

## 🎯 Casos de Uso

### 🆕 Primeira Configuração
```bash
git clone [repositório]
cd [projeto]
pnpm run setup
# Configurar .env manualmente
pnpm run dev
```

### 🔄 Desenvolvimento Diário
```bash
# Verificar se tudo está OK
pnpm run check

# Se houver problemas, reiniciar rapidamente
pnpm run quick-restart

# Para problemas persistentes
pnpm run restart
```

### 🔍 Monitoramento de Produção
```bash
# Monitorar manualmente
pnpm run monitor

# Monitorar com restart automático
pnpm run monitor-auto
```

### 🚨 Resolução de Problemas
```bash
# 1. Diagnóstico
pnpm run check

# 2. Reinicialização completa
pnpm run restart

# 3. Se necessário, reconfigurar
pnpm run setup
```

## ⚡ Funcionalidades dos Scripts

### ✅ O que os scripts fazem:
- 🔪 Matam processos Node.js/Next.js automaticamente
- 🧹 Limpam cache (.next, pnpm store)
- 🔍 Verificam dependências e arquivos essenciais
- 📊 Monitoram CPU, RAM e espaço em disco
- 🌐 Testam conectividade HTTP
- 🔄 Reiniciam automaticamente quando necessário
- 📋 Fornecem diagnósticos detalhados

### 🛡️ Segurança:
- ✅ Verificam permissões antes de executar
- ✅ Fazem backup de configurações importantes
- ✅ Não removem dados do usuário
- ✅ Logs detalhados de todas as operações

## 🖥️ Compatibilidade

| Script | Windows | PowerShell | CMD |
|--------|---------|------------|-----|
| setup.ps1 | ✅ | ✅ | ❌ |
| restart-system.ps1 | ✅ | ✅ | ❌ |
| quick-restart.bat | ✅ | ✅ | ✅ |
| system-check.ps1 | ✅ | ✅ | ❌ |
| monitor.ps1 | ✅ | ✅ | ❌ |

## 🔧 Configuração PowerShell

Se houver problemas de execução:
```powershell
# Permitir execução de scripts (uma vez)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 📊 Exemplo de Saída

### `pnpm run check`
```
🔍 Verificação do Sistema
========================

✅ Node.js: Instalado (v20.10.0)
✅ pnpm: Instalado (8.15.0)
✅ package.json: Encontrado
✅ .env: Encontrado
✅ node_modules: Dependências instaladas

🔄 Processos Ativos:
🟢 Node.js rodando (1 processo(s))
   PID: 12345 - CPU: 2.5%

🌐 Status das Portas:
🟢 Porta 3000: Ocupada (PID: 12345 - node)
🔴 Porta 3001: Livre

💾 Espaço em Disco:
✅ Espaço livre: 45.2 GB de 250 GB (82% usado)

📊 Resumo:
==========
🎉 Sistema está funcionando corretamente!
```

### `pnpm run monitor`
```
🔍 Monitor do Sistema Iniciado
Intervalo: 30 segundos
Pressione Ctrl+C para parar

[14:30:15] Verificação #1
  ✅ Porta 3000: Ativa
  ✅ HTTP: Respondendo (200 OK)
  📊 CPU: 2.1% | RAM: 156.3 MB

[14:30:45] Verificação #2
  ✅ Porta 3000: Ativa
  ✅ HTTP: Respondendo (200 OK)
  📊 CPU: 1.8% | RAM: 158.7 MB
```

## 🆘 Suporte

Para problemas com os scripts:
1. Verifique se PowerShell está habilitado
2. Execute como Administrador se necessário
3. Consulte `scripts/README.md` para detalhes
4. Verifique logs no terminal

## 🔄 Atualizações

Os scripts são atualizados automaticamente com o projeto. Para forçar atualização:
```bash
git pull origin main
pnpm run setup
```