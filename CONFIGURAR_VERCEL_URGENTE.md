# ⚠️ CONFIGURAÇÃO URGENTE - Vercel Environment Variables

## Problema
A rota está funcionando, mas retorna erro **"Invalid API key"** porque a variável `SUPABASE_SERVICE_ROLE_KEY` não está configurada na Vercel.

## Solução IMEDIATA

### Opção 1: Via Dashboard Vercel (RECOMENDADO - 2 minutos)

1. Acesse: https://vercel.com/seu-projeto/settings/environment-variables

2. Adicione a variável:
   - **Name:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaW9nYWJkenlicXhueWhrdGJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg1ODcyOSwiZXhwIjoyMDc1NDM0NzI5fQ.HlJgXvaOLcAOvJa9iV2jNpAqx1du5Ge9-oBD9oYkXuw`
   - **Environments:** Production, Preview, Development (marque todos)

3. Clique em "Save"

4. **IMPORTANTE:** Faça um novo deploy:
   - Vá em: https://vercel.com/seu-projeto/deployments
   - Clique nos 3 pontinhos do último deploy
   - Clique em "Redeploy"

### Opção 2: Via CLI Vercel (se tiver instalado)

```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Cole o valor quando solicitado:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaW9nYWJkenlicXhueWhrdGJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg1ODcyOSwiZXhwIjoyMDc1NDM0NzI5fQ.HlJgXvaOLcAOvJa9iV2jNpAqx1du5Ge9-oBD9oYkXuw

# Depois faça redeploy
vercel --prod
```

## Verificar se Está Configurado

Após adicionar a variável e fazer redeploy, teste novamente:
1. Vá em: https://gestor.engrene.com/dashboard/clients
2. Selecione um cliente
3. Clique em "Conectar Meta"
4. Autorize no Facebook
5. Selecione as contas
6. Clique em "Conectar Selecionadas"
7. ✅ Agora deve funcionar!

## Por Que Isso Aconteceu?

A variável `SUPABASE_SERVICE_ROLE_KEY` é necessária para:
- Fazer operações no banco de dados sem RLS (Row Level Security)
- Salvar conexões Meta independente do usuário logado
- Garantir que as operações sejam feitas com permissões de administrador

## Outras Variáveis Importantes (Verificar se Estão Configuradas)

Na Vercel, você também precisa ter:

1. ✅ `NEXT_PUBLIC_SUPABASE_URL`
2. ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. ⚠️ `SUPABASE_SERVICE_ROLE_KEY` (FALTANDO - ADICIONAR AGORA)
4. ✅ `META_APP_ID`
5. ✅ `META_APP_SECRET`
6. ✅ `NEXT_PUBLIC_APP_URL` (deve ser https://gestor.engrene.com)

## Tempo Estimado

- Adicionar variável: 1 minuto
- Redeploy: 2-3 minutos
- **Total: ~5 minutos**

## Após Configurar

O erro mudará de:
```
❌ Invalid API key
```

Para:
```
✅ Contas conectadas com sucesso!
```
