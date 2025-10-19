# ✅ Teste de Produção - gestor.engrene.com

## 🎯 Configuração Concluída!

Agora vamos testar se tudo está funcionando.

---

## TESTE 1: Site Carrega ✓

Acesse: **https://gestor.engrene.com**

**Esperado**: 
- ✅ Página de login carrega
- ✅ Sem erros no console (F12)
- ✅ Design aparece corretamente

**Se der erro**: Aguarde 1-2 minutos (deploy pode estar finalizando)

---

## TESTE 2: Criar Conta e Login ✓

1. Clique em **"Criar conta"** (ou Sign Up)
2. Preencha:
   - Nome
   - Email
   - Senha
3. Clique em **"Criar conta"**
4. Faça login com as credenciais

**Esperado**: 
- ✅ Conta criada com sucesso
- ✅ Redirecionado para o dashboard

**Se der erro "Usuário não possui organização"**: 
- É normal! Vá para o TESTE 3

---

## TESTE 3: Criar Organização (se necessário) ✓

Se aparecer "Usuário não possui organização":

### 3.1 Pegar seu User ID

1. Acesse: **Supabase Dashboard**
2. Vá em: **Authentication** → **Users**
3. Copie o **ID** do seu usuário (algo como: `a1b2c3d4-...`)

### 3.2 Executar SQL

No **Supabase SQL Editor**, execute:

```sql
-- 1. Criar organização
INSERT INTO organizations (name, created_at)
VALUES ('Engrene', NOW())
RETURNING id;
```

**Copie o ID retornado** (algo como: `x1y2z3w4-...`)

```sql
-- 2. Vincular você à organização
INSERT INTO memberships (user_id, org_id, role)
VALUES (
  'SEU_USER_ID_AQUI',     -- Cole o ID do passo 3.1
  'ORG_ID_DO_PASSO_1',    -- Cole o ID retornado acima
  'super_admin'
);
```

### 3.3 Recarregar Página

- Volte para **gestor.engrene.com**
- Pressione **Ctrl+Shift+R** (limpar cache)
- Faça login novamente

**Esperado**: 
- ✅ Dashboard carrega normalmente
- ✅ Sem mensagem de erro

---

## TESTE 4: Criar Cliente ✓

1. No dashboard, vá em **"Clientes"** (menu lateral)
2. Clique em **"Novo Cliente"** ou **"+ Adicionar Cliente"**
3. Preencha:
   - Nome do cliente
   - Outros dados (opcional)
4. Clique em **"Salvar"**

**Esperado**: 
- ✅ Cliente criado com sucesso
- ✅ Aparece na lista de clientes

**Se der erro**: 
- Verifique os logs do Vercel
- Verifique se a tabela `clients` existe no Supabase

---

## TESTE 5: Conectar Meta Ads ✓

1. Clique no cliente que você criou
2. Procure o botão **"Conectar Meta Ads"** ou **"Connect Facebook"**
3. Clique no botão

**Esperado**: 
- ✅ Redireciona para o Facebook
- ✅ Pede autorização para acessar suas contas de anúncios

### 5.1 Autorizar no Facebook

1. Faça login no Facebook (se necessário)
2. Selecione as permissões
3. Clique em **"Continuar"** ou **"Autorizar"**

**Esperado**: 
- ✅ Redireciona de volta para gestor.engrene.com
- ✅ Mostra página de seleção de contas

### 5.2 Selecionar Contas

1. Marque as contas de anúncios que deseja conectar
2. Marque as páginas (opcional)
3. Clique em **"Conectar Selecionadas"**

**Esperado**: 
- ✅ Volta para o dashboard do cliente
- ✅ Mostra mensagem de sucesso
- ✅ Contas aparecem conectadas

---

## TESTE 6: Ver Campanhas ✓

Após conectar as contas:

1. Ainda na página do cliente
2. Procure a seção **"Campanhas"** ou **"Meta Ads"**

**Esperado**: 
- ✅ Lista de campanhas aparece
- ✅ Métricas são exibidas (impressões, cliques, gastos)
- ✅ Dados estão atualizados

**Se não aparecer nada**:
- Aguarde 30 segundos (sincronização inicial)
- Recarregue a página (F5)
- Verifique se as contas têm campanhas ativas

---

## TESTE 7: Dashboard e Analytics ✓

1. Vá em **"Dashboard"** (menu lateral)
2. Vá em **"Analytics"** (menu lateral)

**Esperado**: 
- ✅ Gráficos carregam
- ✅ Métricas aparecem
- ✅ Dados do cliente conectado são exibidos

---

## 🎯 RESULTADO ESPERADO

Após todos os testes:

```
✅ Site carrega
✅ Login funciona
✅ Organização criada
✅ Cliente criado
✅ Meta Ads conectado
✅ Campanhas aparecem
✅ Dashboard funciona
```

---

## 🚨 PROBLEMAS COMUNS

### ❌ "Redirect URI não corresponde"

**Causa**: Callback URL não configurada corretamente no Meta

**Solução**: 
1. Vá no Meta for Developers
2. Verifique se tem EXATAMENTE: `https://gestor.engrene.com/api/meta/callback`
3. Salve e tente novamente

---

### ❌ "Não autorizado" ou "Forbidden"

**Causa**: Usuário não tem organização ou permissões

**Solução**: Execute o TESTE 3 novamente

---

### ❌ Campanhas não aparecem

**Causa 1**: Sincronização ainda não terminou
**Solução**: Aguarde 30-60 segundos e recarregue

**Causa 2**: Tabelas do banco não existem
**Solução**: Execute `database/meta-ads-schema.sql` no Supabase

**Causa 3**: Contas não têm campanhas ativas
**Solução**: Verifique no Meta Ads Manager se há campanhas

---

### ❌ Erro 500 em qualquer lugar

**Causa**: Variáveis de ambiente ou banco de dados

**Solução**: 
1. Verifique logs do Vercel: https://vercel.com/seu-projeto/logs
2. Verifique se todas as variáveis estão configuradas
3. Verifique se o Supabase está acessível

---

## 📊 MONITORAMENTO

### Ver Logs em Tempo Real

**Vercel**: https://vercel.com/seu-projeto/logs
- Filtre por "Errors" para ver problemas

**Supabase**: Dashboard → Logs → API Logs
- Veja queries que estão sendo executadas

### Testar APIs Diretamente

```bash
# Testar se API está respondendo
curl https://gestor.engrene.com/api/clients

# Deve retornar JSON (mesmo que erro 401 - não autorizado)
```

---

## ✅ CHECKLIST FINAL

Marque conforme for testando:

- [ ] Site carrega em gestor.engrene.com
- [ ] Consegue criar conta
- [ ] Consegue fazer login
- [ ] Dashboard carrega (com ou sem organização)
- [ ] Organização criada via SQL (se necessário)
- [ ] Consegue criar cliente
- [ ] Botão "Conectar Meta Ads" aparece
- [ ] Redireciona para Facebook ao clicar
- [ ] Consegue autorizar no Facebook
- [ ] Volta para gestor.engrene.com após autorizar
- [ ] Página de seleção de contas aparece
- [ ] Consegue selecionar e conectar contas
- [ ] Campanhas aparecem após conectar
- [ ] Métricas são exibidas
- [ ] Dashboard e Analytics funcionam

---

## 🎉 SUCESSO!

Se todos os testes passaram, seu sistema está **100% funcional em produção**!

**Próximos passos**:
- Convidar outros usuários (se aplicável)
- Configurar mais clientes
- Explorar funcionalidades de relatórios
- Configurar notificações (opcional)

---

**Última atualização**: Testes para gestor.engrene.com
**Status**: ⚙️ Aguardando testes do usuário
