# Quick Start - Após Limpeza de Dados Mockados

## 🚀 Passo 1: Faça Login

1. Acesse `http://localhost:3000`
2. Clique em "Entrar" ou "Cadastrar"
3. Use suas credenciais (ou crie uma nova conta)

## 🔧 Passo 2: Inicialize os Dados Mínimos

Escolha uma das opções:

### Opção A: Interface Visual (Mais Fácil)
1. Após fazer login, acesse: `http://localhost:3000/debug/init-data`
2. Clique no botão "Inicializar Dados"
3. Aguarde a mensagem de sucesso
4. Você será redirecionado para o dashboard

### Opção B: SQL Manual (Se a Opção A não funcionar)
1. Vá para [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá para **SQL Editor**
4. Clique em **New Query**
5. Cole o conteúdo de `database/init-minimal-data.sql`
6. Substitua `USER_ID_AQUI` pelo seu ID de usuário:
   - Vá para **Authentication** > **Users**
   - Copie o ID do seu usuário
   - Cole no script
7. Clique em **Run**
8. Recarregue a página do app

### Opção C: API (Para Automação)
```bash
curl -X POST http://localhost:3000/api/debug/init-minimal-data \
  -H "Content-Type: application/json"
```

## ✅ Passo 3: Verifique se Funcionou

1. Acesse `http://localhost:3000/dashboard`
2. Você deve ver:
   - Uma organização chamada "Minha Organização"
   - Um cliente chamado "Cliente Padrão"
   - Seu nome de usuário no canto superior direito

## 🎯 Próximos Passos

Agora que o app está funcionando:

1. **Crie mais clientes**:
   - Vá para Dashboard > Clientes
   - Clique em "Adicionar Cliente"

2. **Conecte Meta Ads**:
   - Vá para Dashboard > Meta
   - Clique em "Conectar Meta Ads"

3. **Conecte Google Ads**:
   - Vá para Dashboard > Google
   - Clique em "Conectar Google Ads"

4. **Convide usuários**:
   - Vá para Dashboard > Equipe
   - Clique em "Convidar Usuário"

## 🆘 Troubleshooting

### "Erro: Usuário não autenticado"
- Você não está logado
- Faça login primeiro em `http://localhost:3000/login`

### "Erro ao criar organização"
- As tabelas do banco não existem
- Execute: `database/complete-schema.sql` no Supabase SQL Editor

### "Erro ao criar membership"
- Pode haver um conflito de dados
- Verifique se já existe uma membership para este usuário
- Consulte `AUTH_RECOVERY_GUIDE.md` para mais detalhes

### "Dashboard vazio após inicializar"
- Recarregue a página (F5)
- Limpe o cache do navegador (Ctrl+Shift+Delete)
- Verifique os logs do console (F12)

## 📝 Notas Importantes

- ⚠️ Os endpoints `/debug/*` são apenas para desenvolvimento
- ⚠️ Remova-os antes de fazer deploy em produção
- ✅ Sempre mantenha backup dos dados importantes
- ✅ Use migrations para dados de teste

## 📚 Documentação Completa

Para mais detalhes, consulte:
- `AUTH_RECOVERY_GUIDE.md` - Guia completo de recuperação
- `AUTH_FIX_SUMMARY.md` - Resumo técnico da solução
- `database/init-minimal-data.sql` - Script SQL

## 🎉 Pronto!

Seu app deve estar funcionando agora. Se tiver problemas, consulte a documentação acima ou verifique os logs do servidor.
