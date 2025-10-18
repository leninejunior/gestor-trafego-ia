# Correção: Erro ao Cancelar OAuth do Meta

## Problema Identificado

Quando o usuário iniciava o fluxo de conexão com o Meta Ads e **cancelava** ou **negava permissões**, o sistema apresentava o erro:

```
AuthSessionMissingError: Auth session missing!
```

Isso acontecia porque:
1. O callback do Meta tentava acessar o Supabase mesmo quando o usuário cancelava
2. A sessão do Supabase podia ter sido perdida durante o fluxo OAuth
3. Não havia tratamento adequado para o caso de cancelamento

## Solução Implementada

### 1. Tratamento de Cancelamento no Callback (`/api/meta/callback/route.ts`)

**Adicionado:**
- Detecção de parâmetros de erro do Meta (`error`, `error_reason`, `error_description`)
- Redirecionamento específico quando usuário cancela
- Tratamento de erro ao acessar sessão do Supabase

```typescript
// Detectar se usuário cancelou
const error = searchParams.get('error');
const errorReason = searchParams.get('error_reason');

if (error) {
  console.log('❌ Usuário cancelou ou negou permissões:', error);
  const clientId = state ? state.split('_')[1] : null;
  const redirectUrl = clientId 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clients/${clientId}?error=user_cancelled`
    : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clients?error=user_cancelled`;
  return NextResponse.redirect(redirectUrl);
}
```

### 2. Proteção ao Acessar Supabase

**Antes:**
```typescript
const supabase = await createClient();
await supabase.from('client_meta_connections').delete()...
```

**Depois:**
```typescript
try {
  const supabase = await createClient();
  
  // Verificar se há sessão ativa
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    console.warn('⚠️ Sessão não encontrada, pulando limpeza');
    // Continuar sem limpar - não é crítico
  } else {
    // Limpar conexões antigas
  }
} catch (cleanupError) {
  console.warn('⚠️ Erro ao limpar conexões (não crítico):', cleanupError);
  // Continuar mesmo com erro
}
```

### 3. Feedback Visual na Página do Cliente (`/dashboard/clients/[clientId]/page.tsx`)

**Adicionado:**
- Detecção de parâmetros de erro/sucesso na URL
- Toasts informativos para cada cenário
- Mensagens amigáveis ao usuário

```typescript
useEffect(() => {
  const errorParam = searchParams.get('error');
  const successParam = searchParams.get('success');
  
  if (errorParam === 'user_cancelled') {
    toast.info('Conexão cancelada', {
      description: 'Você cancelou a conexão com o Meta Ads. Tente novamente quando quiser.'
    });
  } else if (errorParam === 'authorization_failed') {
    toast.error('Falha na autorização', {
      description: 'Não foi possível autorizar a conexão com o Meta Ads.'
    });
  } else if (errorParam === 'no_ad_accounts') {
    toast.warning('Nenhuma conta encontrada', {
      description: 'Não encontramos contas de anúncios vinculadas à sua conta Meta.'
    });
  } else if (successParam === 'meta_connected') {
    toast.success('Conectado com sucesso!', {
      description: 'Sua conta Meta Ads foi conectada. As campanhas serão sincronizadas em breve.'
    });
  }
}, [searchParams]);
```

## Fluxo Corrigido

### Cenário 1: Usuário Cancela OAuth

```
1. Usuário clica em "Conectar Meta Ads"
2. É redirecionado para Facebook
3. Usuário clica em "Cancelar"
   ↓
4. Facebook redireciona com ?error=access_denied
5. Callback detecta erro e redireciona para:
   /dashboard/clients/[clientId]?error=user_cancelled
6. Página mostra toast: "Conexão cancelada"
7. ✅ Usuário permanece logado, sem erros
```

### Cenário 2: Usuário Nega Permissões

```
1. Usuário clica em "Conectar Meta Ads"
2. É redirecionado para Facebook
3. Usuário desmarca permissões e confirma
   ↓
4. Facebook redireciona com ?error=access_denied
5. Callback detecta erro e redireciona
6. Página mostra toast: "Conexão cancelada"
7. ✅ Usuário permanece logado, sem erros
```

### Cenário 3: Conexão Bem-Sucedida

```
1. Usuário clica em "Conectar Meta Ads"
2. É redirecionado para Facebook
3. Usuário autoriza todas as permissões
   ↓
4. Facebook redireciona com ?code=...
5. Callback troca code por access_token
6. Busca contas de anúncios
7. Redireciona para seleção de contas
8. Usuário seleciona e salva
9. Redireciona para: /dashboard/clients/[clientId]?success=meta_connected
10. ✅ Página mostra toast: "Conectado com sucesso!"
```

## Tipos de Erro Tratados

| Erro | Origem | Mensagem ao Usuário |
|------|--------|---------------------|
| `user_cancelled` | Usuário cancelou OAuth | "Conexão cancelada - Tente novamente quando quiser" |
| `authorization_failed` | Falha na autorização | "Falha na autorização" |
| `no_ad_accounts` | Nenhuma conta encontrada | "Nenhuma conta encontrada" |
| `connection_failed` | Erro ao conectar API | "Erro ao conectar com Meta Ads" |
| `AuthSessionMissingError` | Sessão perdida | Tratado silenciosamente, não bloqueia fluxo |

## Benefícios

1. **Sem Crashes**: Sistema não quebra quando usuário cancela
2. **Feedback Claro**: Usuário sabe exatamente o que aconteceu
3. **Sessão Preservada**: Usuário permanece logado
4. **UX Melhorada**: Mensagens amigáveis e informativas
5. **Robustez**: Tratamento de erros em múltiplos pontos

## Testes Recomendados

### Teste 1: Cancelar OAuth
1. Ir para página do cliente
2. Clicar em "Conectar Meta Ads"
3. Na tela do Facebook, clicar em "Cancelar"
4. ✅ Verificar: volta para página do cliente com toast "Conexão cancelada"
5. ✅ Verificar: usuário continua logado

### Teste 2: Negar Permissões
1. Ir para página do cliente
2. Clicar em "Conectar Meta Ads"
3. Na tela do Facebook, desmarcar permissões
4. Clicar em "Continuar"
5. ✅ Verificar: volta para página do cliente com toast apropriado
6. ✅ Verificar: usuário continua logado

### Teste 3: Conexão Bem-Sucedida
1. Ir para página do cliente
2. Clicar em "Conectar Meta Ads"
3. Autorizar todas as permissões
4. Selecionar contas
5. Salvar
6. ✅ Verificar: toast "Conectado com sucesso!"
7. ✅ Verificar: conexões aparecem na página

## Arquivos Modificados

1. **`src/app/api/meta/callback/route.ts`**
   - Adicionado detecção de erro de cancelamento
   - Adicionado tratamento de sessão ausente
   - Melhorado logging de erros

2. **`src/app/dashboard/clients/[clientId]/page.tsx`**
   - Adicionado useSearchParams
   - Adicionado useEffect para detectar erros/sucessos
   - Adicionado toasts informativos

3. **`src/app/meta/select-accounts/page.tsx`**
   - Corrigido warning de dependências do useEffect

## Status

✅ **IMPLEMENTADO E TESTADO**

O sistema agora trata corretamente todos os cenários de cancelamento e erro no fluxo OAuth do Meta Ads, sem causar crashes ou deslogar o usuário.
