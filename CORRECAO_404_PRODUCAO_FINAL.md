# 🔧 Correção 404 em Produção - API save-selected

## Problema Identificado

A API `/api/meta/save-selected` estava retornando 404 em produção, mas funcionava localmente.

### Causa Raiz
- Cache da Vercel não atualizou após o primeiro deploy
- Build anterior não incluiu as novas rotas corretamente

## Solução Aplicada

### 1. Forçar Rebuild
```bash
# Alteração mínima no arquivo para forçar rebuild
git add .
git commit -m "fix: força rebuild da API save-selected em produção"
git push origin main
```

### 2. Aguardar Deploy
- Vercel detectará automaticamente o push
- Novo build será iniciado
- Aguarde 2-5 minutos

### 3. Limpar Cache do Navegador
Após o deploy:
1. Abra DevTools (F12)
2. Clique com botão direito no ícone de reload
3. Selecione "Limpar cache e recarregar"

## Como Verificar se Funcionou

### Teste 1: Verificar API Diretamente
```bash
curl -X POST https://seu-dominio.vercel.app/api/meta/save-selected \
  -H "Content-Type: application/json" \
  -d '{"client_id":"test","access_token":"test","selected_accounts":[]}'
```

**Resposta esperada:**
- Status: 400 (Bad Request) - porque os dados são inválidos
- Corpo: `{"error": "Dados obrigatórios ausentes"}`

**Se ainda der 404:**
- API não foi deployada corretamente
- Verificar logs da Vercel

### Teste 2: Testar no Navegador
1. Acesse: https://seu-dominio.vercel.app
2. Faça login
3. Vá em Clientes
4. Clique em "Conectar Meta Ads"
5. Autorize no Facebook
6. Selecione contas
7. Clique em "Conectar Selecionadas"

**Comportamento esperado:**
- ✅ Requisição para `/api/meta/save-selected` retorna 200
- ✅ Toast de sucesso aparece
- ✅ Redirecionamento para página do cliente

## Troubleshooting Adicional

### Se ainda der 404 após novo deploy:

#### 1. Verificar Logs da Vercel
```
1. Acesse Vercel Dashboard
2. Vá em seu projeto
3. Clique em "Deployments"
4. Selecione o último deployment
5. Veja "Build Logs"
```

Procure por:
- Erros de compilação
- Avisos sobre rotas não encontradas
- Problemas com TypeScript

#### 2. Verificar Estrutura de Arquivos
A estrutura deve ser:
```
src/app/api/meta/save-selected/
└── route.ts
```

**NÃO deve ser:**
- `src/app/api/meta/save-selected.ts` ❌
- `src/app/api/meta/save-selected/index.ts` ❌

#### 3. Verificar Exports
O arquivo `route.ts` deve exportar:
```typescript
export async function POST(request: NextRequest) {
  // ...
}
```

**NÃO deve ser:**
- `export default function POST` ❌
- `export const POST` ❌

#### 4. Forçar Redeploy Manual
Se nada funcionar:
```
1. Vá em Vercel Dashboard
2. Selecione seu projeto
3. Vá em "Deployments"
4. Clique em "..." no último deployment
5. Selecione "Redeploy"
6. Marque "Use existing Build Cache" como DESMARCADO
7. Clique em "Redeploy"
```

### Se o problema persistir:

#### Solução Temporária: Usar API Alternativa
O código já tem fallback para `/api/meta/save`:

```typescript
// Já implementado no select-accounts/page.tsx
if (response.status === 404) {
  response = await fetch('/api/meta/save', {
    method: 'POST',
    // ...
  });
}
```

Você pode criar essa API alternativa:
```bash
# Criar arquivo
mkdir -p src/app/api/meta/save
# Copiar conteúdo de save-selected/route.ts
cp src/app/api/meta/save-selected/route.ts src/app/api/meta/save/route.ts
```

## Prevenção Futura

### 1. Sempre Testar Localmente Antes
```bash
pnpm build
pnpm start
# Testar em http://localhost:3000
```

### 2. Verificar Build Logs
Antes de fazer push, verificar se não há erros:
```bash
pnpm build 2>&1 | tee build.log
```

### 3. Usar Staging Environment
Configure um ambiente de staging na Vercel:
- Branch `staging` → Deploy de staging
- Branch `main` → Deploy de produção

### 4. Monitorar Deployments
Configure notificações da Vercel:
- Email quando deploy falhar
- Slack/Discord webhook para status

## Status Atual

✅ **Commit enviado**: `cbbf283`
✅ **Mensagem**: "fix: força rebuild da API save-selected em produção"
✅ **Deploy**: Iniciado automaticamente
⏳ **Aguardando**: 2-5 minutos para conclusão

## Próximos Passos

1. **Aguardar deploy** (2-5 min)
2. **Limpar cache do navegador**
3. **Testar conexão Meta Ads**
4. **Verificar se 404 sumiu**

Se funcionar, marque como resolvido! 🎉

---

**Última atualização:** 11/11/2025 20:15
**Status:** 🔄 Deploy em andamento
