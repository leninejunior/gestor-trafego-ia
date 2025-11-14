# Troubleshooting - Google OAuth "State Inválido"

## Problema: "State OAuth inválido ou expirado"

Este erro ocorre quando o sistema não consegue validar o state OAuth durante o callback.

## Causas Comuns

### 1. State Expirado (Mais Comum)
- **Sintoma**: Erro após demorar muito tempo na tela de autorização do Google
- **Causa**: O state tem validade de 30 minutos
- **Solução**: Refazer o processo de conexão mais rapidamente

### 2. State Não Salvo no Banco
- **Sintoma**: Erro imediato após autorizar no Google
- **Causa**: Falha ao salvar o state no banco de dados
- **Solução**: Verificar logs do servidor e conexão com Supabase

### 3. Problema de Timezone
- **Sintoma**: Erro mesmo fazendo rapidamente
- **Causa**: Diferença de timezone entre servidor e banco
- **Solução**: Verificar configuração de timezone no Supabase

## Como Debugar

### 1. Verificar States no Banco

Acesse a rota de debug:
```
GET /api/google/debug-state
```

Ou para um state específico:
```
GET /api/google/debug-state?state=SEU_STATE_AQUI
```

### 2. Verificar Logs do Servidor

Procure por estas mensagens nos logs:

**No início do OAuth:**
```
[Google Auth POST] 💾 SALVANDO ESTADO OAUTH NO BANCO...
[Google Auth POST] ✅ ESTADO OAUTH SALVO COM SUCESSO
```

**No callback:**
```
[Google Callback] 🔍 VALIDANDO STATE NO BANCO...
[Google Callback] ✅ STATE VÁLIDO
```

### 3. Verificar Tabela oauth_states

Execute no Supabase SQL Editor:

```sql
-- Ver todos os states recentes
SELECT 
  id,
  LEFT(state, 20) as state_preview,
  client_id,
  user_id,
  provider,
  created_at,
  expires_at,
  (expires_at > NOW()) as is_valid
FROM oauth_states
WHERE provider = 'google'
ORDER BY created_at DESC
LIMIT 10;

-- Limpar states expirados
DELETE FROM oauth_states WHERE expires_at < NOW();
```

## Soluções

### Solução 1: Aumentar Tempo de Expiração

Se os usuários estão demorando muito, edite `src/app/api/google/auth/route.ts`:

```typescript
// Mudar de 30 para 60 minutos
const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
```

### Solução 2: Verificar RLS Policies

Certifique-se que as políticas RLS estão corretas:

```sql
-- Verificar políticas
SELECT * FROM pg_policies WHERE tablename = 'oauth_states';

-- Recriar política se necessário
DROP POLICY IF EXISTS "Users can only access their own OAuth states" ON oauth_states;

CREATE POLICY "Users can only access their own OAuth states"
  ON oauth_states
  FOR ALL
  USING (user_id = auth.uid());
```

### Solução 3: Limpar Cache do Navegador

Às vezes o navegador pode estar usando dados antigos:

1. Abra DevTools (F12)
2. Vá em Application > Storage
3. Clique em "Clear site data"
4. Tente novamente

## Fluxo Correto

1. **Usuário clica em "Conectar Google Ads"**
   - Sistema gera state único
   - Salva no banco com validade de 30 minutos
   - Redireciona para Google

2. **Usuário autoriza no Google**
   - Google redireciona de volta com code e state
   - Sistema valida state no banco
   - Se válido, troca code por tokens

3. **Sistema salva conexão**
   - Salva tokens no banco
   - Remove state usado
   - Redireciona para seleção de contas

## Monitoramento

### Verificar Taxa de Erro

```sql
-- Ver quantos states estão expirando sem uso
SELECT 
  COUNT(*) as total_states,
  COUNT(*) FILTER (WHERE expires_at < NOW()) as expired,
  COUNT(*) FILTER (WHERE expires_at >= NOW()) as valid
FROM oauth_states
WHERE provider = 'google'
  AND created_at > NOW() - INTERVAL '24 hours';
```

### Alertas Recomendados

- Taxa de erro > 10% em callbacks OAuth
- States expirando sem uso > 50%
- Tempo médio entre criação e uso > 5 minutos

## Contato

Se o problema persistir após seguir este guia, verifique:

1. Logs completos do servidor
2. Configuração do Supabase
3. Variáveis de ambiente
4. Conexão de rede do servidor
