# 🔧 Solução para Rate Limit no Signup

## ❌ Problema

Você está vendo dois erros:

1. **Erro 500**: "Erro ao criar checkout"
2. **Erro 400**: "For security purposes, you can only request this after 39 seconds"

## 🎯 Causa

O **segundo erro** é um **rate limit do Supabase Auth**. O Supabase limita a criação de usuários para prevenir abuso:
- Você tentou criar vários usuários muito rapidamente
- Precisa aguardar ~60 segundos entre tentativas

O **primeiro erro** pode ser causado por:
- Configuração do Iugu incompleta
- Erro na criação do checkout
- Problema com o plano selecionado

## ✅ Soluções

### Solução 1: Aguardar o Rate Limit (Imediato)

Simplesmente **aguarde 60 segundos** e tente novamente. O rate limit é temporário.

```bash
# Aguarde 60 segundos e tente criar a conta novamente
```

### Solução 2: Limpar Usuários de Teste (Recomendado)

Se você criou vários usuários de teste, limpe-os no Supabase:

1. Acesse: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/auth/users
2. Delete os usuários de teste (teste@exemplo.com, etc.)
3. Aguarde 1 minuto
4. Tente criar uma conta real

### Solução 3: Usar Email Diferente

O rate limit é por IP, mas usar um email diferente pode ajudar:

```
Ao invés de: teste@exemplo.com
Use: seuemail+teste1@gmail.com
```

## 🔍 Investigar Erro do Checkout

Para ver o erro real do checkout, verifique os logs do servidor Next.js no terminal onde você rodou `npm run dev`.

Procure por:
```
Iugu checkout creation error: ...
```

## 🛠️ Melhorias Aplicadas

Atualizei o código para:

1. ✅ Mostrar mensagem mais clara sobre rate limit
2. ✅ Exibir detalhes do erro de checkout
3. ✅ Melhor tratamento de erros

## 📝 Próximos Passos

### Se o erro persistir após aguardar:

1. **Verifique os logs do servidor** no terminal
2. **Verifique a configuração do Iugu** no `.env`:
   ```env
   IUGU_API_TOKEN=...
   IUGU_ACCOUNT_ID=...
   ```
3. **Teste o signup sem checkout** (criar endpoint simplificado)

### Teste Simplificado

Vou criar um endpoint de signup simplificado que não requer checkout imediato:

```bash
# Criar conta sem checkout
POST /api/auth/signup-simple
{
  "email": "seu@email.com",
  "password": "senha123",
  "name": "Seu Nome",
  "organization_name": "Sua Empresa"
}
```

## 🎯 Recomendação

Para desenvolvimento e testes:

1. **Use emails únicos** para cada teste
2. **Aguarde 60 segundos** entre tentativas
3. **Delete usuários de teste** regularmente
4. **Configure um plano gratuito** que não requer checkout

## 🔒 Em Produção

O rate limit do Supabase é importante para segurança. Em produção:
- Usuários reais raramente criam múltiplas contas
- O limite é por IP, então não afeta usuários diferentes
- É uma proteção contra bots e abuso

## ⏰ Tempo de Espera

Se você viu "after 39 seconds", significa:
- Você precisa aguardar **39 segundos** antes de tentar novamente
- O contador é do Supabase, não do nosso código
- Após esse tempo, você poderá criar uma nova conta

## 🧪 Teste Agora

Aguarde 60 segundos e tente:

1. Acesse: `http://localhost:3000/checkout?plan=SEU_PLAN_ID`
2. Use um **email diferente** (não teste@exemplo.com)
3. Preencha o formulário
4. Clique em "Finalizar Cadastro"

Se o erro persistir, compartilhe os logs do terminal!
