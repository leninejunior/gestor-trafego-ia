# Scripts de Automação do Sistema

Esta pasta contém scripts para automatizar tarefas comuns do sistema.

## 📋 Scripts Disponíveis

### 🚀 `setup.ps1` - Configuração Inicial
**Uso:** `pnpm run setup` ou `.\scripts\setup.ps1`

Configura o ambiente pela primeira vez:
- ✅ Verifica pré-requisitos (Node.js, Git)
- 📦 Instala pnpm se necessário
- ⚙️ Cria arquivo .env a partir de env.exemple
- 📚 Instala todas as dependências
- 🔨 Testa o build
- 📋 Mostra próximos passos para configuração

### 🔄 `restart-system.ps1` - Reinicialização Completa
**Uso:** `pnpm run restart` ou `.\scripts\restart-system.ps1`

Reinicialização completa do sistema:
- 🔪 Mata todos os processos Node.js/Next.js
- 🔍 Verifica dependências e arquivos essenciais
- 🧹 Limpa cache (pnpm, Next.js)
- 📦 Opção de reinstalar dependências
- 🔨 Verifica build
- 🚀 Inicia o sistema

### ⚡ `quick-restart.bat` - Reinicialização Rápida
**Uso:** `pnpm run quick-restart` ou `.\scripts\quick-restart.bat`

Reinicialização rápida sem verificações:
- 🔪 Mata processos rapidamente
- 🧹 Limpa cache do Next.js
- 🚀 Inicia imediatamente

### 🔍 `system-check.ps1` - Verificação do Sistema
**Uso:** `pnpm run check` ou `.\scripts\system-check.ps1`

Verifica a saúde do sistema sem reiniciar:
- ✅ Status de Node.js, pnpm, arquivos
- 🔄 Processos ativos
- 🌐 Status das portas (3000, 3001, 5000)
- 💾 Espaço em disco
- 🗂️ Tamanho do cache
- 📊 Resumo geral

## 🖥️ Compatibilidade

### Windows
- ✅ PowerShell (.ps1) - Scripts principais
- ✅ Batch (.bat) - Scripts rápidos
- ✅ CMD - Todos os scripts funcionam

### Execução de PowerShell
Se houver erro de política de execução:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 🚨 Solução de Problemas

### "Processo não pode ser finalizado"
- Execute como Administrador
- Use o Task Manager para finalizar manualmente
- Reinicie o computador se necessário

### "pnpm não encontrado"
- Execute: `npm install -g pnpm`
- Ou use o script setup.ps1

### "Porta 3000 ocupada"
- Os scripts automaticamente liberam a porta
- Manualmente: `netstat -ano | findstr :3000`
- Depois: `taskkill /f /pid [PID]`

### "Erro de permissão PowerShell"
```powershell
# Temporário (sessão atual)
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# Permanente (usuário atual)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 📝 Logs e Debug

### Logs dos Scripts
- PowerShell: Saída colorida no terminal
- Batch: Saída simples no CMD
- Erros são exibidos em vermelho

### Debug Manual
```bash
# Verificar processos Node.js
tasklist | findstr node

# Verificar portas ocupadas
netstat -ano | findstr :3000

# Verificar espaço em disco
dir /-c

# Limpar cache manualmente
rmdir /s /q .next
rmdir /s /q node_modules
```

## 🔧 Personalização

### Adicionar Nova Porta
Edite os scripts e adicione a porta desejada:
```powershell
# Em restart-system.ps1
Stop-ProcessByPort -Port 8080

# Em quick-restart.bat
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8080"') do (
    taskkill /f /pid %%a >nul 2>&1
)
```

### Modificar Verificações
No `system-check.ps1`, adicione novas verificações:
```powershell
$customOk = Test-SystemComponent -Name "MinhaVerificacao" -Test {
    # Sua lógica aqui
    return $true
} -SuccessMessage "OK" -FailMessage "Erro"
```

## 📚 Exemplos de Uso

### Desenvolvimento Diário
```bash
# Manhã - verificar sistema
pnpm run check

# Problema? Reinicialização rápida
pnpm run quick-restart

# Problema persistente? Reinicialização completa
pnpm run restart
```

### Configuração Nova Máquina
```bash
# 1. Clonar repositório
git clone [repo]

# 2. Configuração inicial
pnpm run setup

# 3. Configurar .env manualmente

# 4. Iniciar desenvolvimento
pnpm run dev
```

### Resolução de Problemas
```bash
# 1. Verificar o que está errado
pnpm run check

# 2. Tentar reinicialização completa
pnpm run restart

# 3. Se necessário, reinstalar dependências
# (opção no script restart)
```