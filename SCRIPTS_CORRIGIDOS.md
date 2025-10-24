# ✅ Scripts de Desenvolvimento Corrigidos

## Problemas Identificados

1. **Flag `--webpack` desnecessária** no comando `dev` do `package.json`
2. **Falta de `setlocal enabledelayedexpansion`** nos scripts batch
3. **Detecção de package manager inconsistente**
4. **Falta de feedback visual** durante o processo

## Correções Aplicadas

### 1. package.json

**Antes:**
```json
"dev": "next dev --webpack"
```

**Depois:**
```json
"dev": "next dev"
```

A flag `--webpack` foi removida pois o Next.js 15 usa Turbopack por padrão e essa flag pode causar conflitos.

### 2. scripts/dev.bat

**Melhorias:**
- ✅ Adicionado `setlocal enabledelayedexpansion`
- ✅ Verificação de diretório correto
- ✅ Melhor feedback visual
- ✅ Detecção correta de package manager
- ✅ Mensagens mais claras

**Uso:**
```bash
scripts\dev.bat
```

### 3. scripts/restart.bat

**Melhorias:**
- ✅ Adicionado `setlocal enabledelayedexpansion`
- ✅ Processo em 5 etapas com feedback
- ✅ Detecção melhorada de package manager
- ✅ Limpeza mais eficiente
- ✅ Informações sobre rotas principais

**Uso:**
```bash
scripts\restart.bat
```

## Como Usar

### Iniciar Servidor (Primeira Vez)

```bash
# Opção 1: Usar script direto
scripts\dev.bat

# Opção 2: Usar npm script
npm run dev

# Opção 3: Usar pnpm (se instalado)
pnpm dev
```

### Reiniciar Servidor (Limpar Cache)

```bash
# Opção 1: Usar script direto
scripts\restart.bat

# Opção 2: Usar npm script
npm run restart
```

## Fluxo dos Scripts

### dev.bat
```
1. Verificar diretório
   ↓
2. Finalizar processos Node.js
   ↓
3. Liberar porta 3000
   ↓
4. Limpar cache .next
   ↓
5. Detectar package manager (pnpm > yarn > npm)
   ↓
6. Iniciar servidor
```

### restart.bat
```
1. Verificar diretório
   ↓
2. Finalizar todos os processos
   ↓
3. Liberar porta 3000
   ↓
4. Limpar cache .next
   ↓
5. Detectar package manager
   ↓
6. Aguardar 2 segundos
   ↓
7. Iniciar servidor
```

## Detecção de Package Manager

Os scripts detectam automaticamente qual package manager usar:

1. **pnpm** - Se existe `pnpm-lock.yaml` e pnpm está instalado
2. **yarn** - Se existe `yarn.lock` e yarn está instalado
3. **npm** - Fallback padrão

## Rotas Disponíveis

Após iniciar o servidor:

- **Home**: http://localhost:3000
- **Dashboard**: http://localhost:3000/dashboard
- **Admin**: http://localhost:3000/admin
- **Checkout**: http://localhost:3000/checkout

## Troubleshooting

### Erro: "Execute este script a partir da raiz do projeto"

**Solução:** Navegue até a raiz do projeto antes de executar:
```bash
cd C:\Users\Amitie Chocolates\Desktop\gestor-engrene
scripts\restart.bat
```

### Porta 3000 ainda ocupada

**Solução:** Execute o script restart.bat que força a liberação:
```bash
scripts\restart.bat
```

### Package manager não detectado

**Solução:** Instale pnpm ou use npm:
```bash
npm install -g pnpm
```

## Comandos Úteis

```bash
# Verificar processos Node.js
tasklist | find "node.exe"

# Verificar porta 3000
netstat -ano | find "3000"

# Matar processo específico
taskkill /f /pid [PID]

# Limpar cache manualmente
rmdir /s /q .next
```

## Status

✅ **CORRIGIDO** - Os scripts agora funcionam corretamente!

Você pode usar:
- `scripts\dev.bat` para iniciar
- `scripts\restart.bat` para reiniciar com limpeza
- `npm run dev` como alternativa
