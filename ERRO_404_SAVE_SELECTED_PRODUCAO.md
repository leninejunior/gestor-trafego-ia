# ❌ Erro 404: /api/meta/save-selected em Produção

## 🔍 Problema Identificado

A API `/api/meta/save-selected` retorna **404 em produção** (gestor.engrene.com), mas funciona em desenvolvimento.

**Erro no Console do Navegador:**
```
Failed to load resource: the server responded with a status of 404 ()
📡 [SELECT ACCOUNTS] Resposta do save: 404
❌ [SELECT ACCOUNTS] Erro ao salvar
```

**Client ID:** `e3ab33da-79f9-45e9-a43f-6ce76ceb9751`

## 🎯 Causa Raiz

A rota existe no código (`src/app/api/meta/save-selected/route.ts`), mas não está sendo reconhecida em produção. Causas possíveis:

1. **Build cache do Vercel** - Não detectou a nova rota
2. **Deploy incompleto** - Arquivo não foi enviado
3. **Problema de roteamento** - Next.js não registrou a rota

## ✅ Soluções

### Solução 1: Forçar Rebuild no Vercel (MAIS RÁPIDO)

1. Acesse: https://vercel.com/seu-projeto/deployments
2. Clique nos 3 pontos do último deploy
3. Selecione **"Redeploy"**
4. **IMPORTANTE:** Desmarque "Use existing Build Cache"
5. Clique em "Redeploy"
6. Aguarde 2-3 minutos

### Solução 2: Commit e Push para Forçar Deploy

```bash
# Fazer um commit vazio para forçar deploy
git commit --allow-empty -m "fix: forçar rebuild para corrigir rota save-selected"
git push origin main
```

### Solução 3: Verificar Logs do Vercel

1. Acesse o dashboard do Vercel
2. Vá em "Deployments" > Último deploy
3. Clique em "View Function Logs"
4. Procure por erros relacionados a `/api/meta/save-selected`

### Solução 4: Verificar Estrutura de Arquivos

Confirme que a estrutura está correta:

```
src/app/api/meta/
├── accounts/
│   └── route.ts
├── auth/
│   └── route.ts  
├── callback/
│   └── route.ts
├── save-selected/
│   └── route.ts  ← DEVE EXISTIR
└── connections/
    └── clear-all/
        └── route.ts
```

## 🔧 Solução Temporária: Usar Callback Direto

Enquanto o problema não é resolvido, modifique a página de seleção para salvar via callback:

### Opção A: Modificar Frontend para Usar API Alternativa

Edite `src/app/meta/select-accounts/page.tsx`:

```typescript
// Trocar de:
const response = await fetch('/api/meta/save-selected', {

// Para:
const response = await fetch('/api/meta/callback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: 'direct_save',
    state: `client_${client_id}`,
    access_token: accessToken,
    selected_accounts: selectedAccounts,
    ad_accounts: adAccounts
  })
});
```

### Opção B: Criar Rota Alternativa

Crie `src/app/api/meta/save/route.ts` (nome mais curto):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, access_token, selected_accounts, ad_accounts } = body;

    if (!client_id || !access_token || !selected_accounts?.length) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 });
    }

    const { createServiceClient } = require('@/lib/supabase/server');
    const supabase = createServiceClient();

    // Verificar cliente
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Remover conexões antigas
    await supabase
      .from('client_meta_connections')
      .delete()
      .eq('client_id', client_id);

    // Inserir novas conexões
    const connections = selected_accounts.map((accountId: string) => {
      const account = ad_accounts.find((acc: any) => acc.id === accountId);
      return {
        client_id,
        ad_account_id: accountId,
        access_token,
        account_name: account?.name || `Conta ${accountId}`,
        currency: account?.currency || 'USD',
        is_active: true
      };
    });

    const { error } = await supabase
      .from('client_meta_connections')
      .insert(connections);

    if (error) {
      return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `${selected_accounts.length} conta(s) conectada(s)` 
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
```

## 🐛 Debug em Produção

Para verificar se a rota existe em produção:

```bash
# Testar diretamente
curl -X POST https://gestor.engrene.com/api/meta/save-selected \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

Se retornar 404, a rota não existe no build.
Se retornar 400/500, a rota existe mas há erro de validação.

## 📝 Checklist de Resolução

- [ ] Verificar se arquivo existe: `src/app/api/meta/save-selected/route.ts`
- [ ] Fazer commit e push das alterações
- [ ] Forçar rebuild no Vercel (sem cache)
- [ ] Aguardar deploy completar
- [ ] Testar em produção
- [ ] Se não funcionar, usar rota alternativa `/api/meta/save`

## 🎯 Próximos Passos

1. **AGORA:** Forçar rebuild no Vercel
2. **Se não resolver:** Criar rota alternativa `/api/meta/save`
3. **Depois:** Investigar por que a rota original não foi deployada

---

**Status:** 🔴 Problema identificado - Aguardando rebuild
**Prioridade:** Alta
**Impacto:** Usuários não conseguem conectar contas Meta em produção
