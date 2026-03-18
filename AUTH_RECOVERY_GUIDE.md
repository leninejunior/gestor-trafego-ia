# Guia de Recuperação de Autenticação

## Problema

Após remover os dados mockados, o auth quebrou porque:

1. **Sem organização**: O sistema requer uma organização para funcionar
2. **Sem cliente**: Cada organização precisa ter pelo menos um cliente
3. **Sem membership**: O usuário precisa estar associado à organização

As políticas RLS (Row Level Security) do banco de dados filtram dados por `org_id`, então sem uma organização, o usuário não consegue acessar nada.

## Solução Rápida

### Opção 1: Via Interface (Recomendado)

1. Faça login normalmente
2. Acesse: `http://localhost:3000/debug/init-data`
3. Clique em "Inicializar Dados"
4. Pronto! Você será redirecionado para o dashboard

### Opção 2: Via SQL (Manual)

1. Vá para Supabase Dashboard > SQL Editor
2. Execute o script: `database/init-minimal-data.sql`
3. Substitua `USER_ID_AQUI` pelo seu ID de usuário (encontre em Authentication > Users)
4. Execute e recarregue a página

### Opção 3: Via API (Programático)

```bash
curl -X POST http://localhost:3000/api/debug/init-minimal-data \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## O que foi criado

Após executar a inicialização:

- ✅ Uma organização chamada "Minha Organização"
- ✅ Um cliente chamado "Cliente Padrão"
- ✅ Uma membership associando você à organização com role "admin"

## Próximos Passos

1. Acesse o dashboard: `http://localhost:3000/dashboard`
2. Crie mais clientes conforme necessário
3. Convide outros usuários para sua organização

## Prevenção Futura

Para evitar esse problema novamente:

1. **Nunca remova dados de organização/cliente sem backup**
2. **Sempre mantenha pelo menos uma organização e cliente**
3. **Use migrations para dados de teste** em vez de deletar tudo

## Troubleshooting

### "Usuário não autenticado"
- Faça login primeiro
- Verifique se o token está válido

### "Erro ao criar organização"
- Verifique se a tabela `organizations` existe
- Execute: `database/complete-schema.sql`

### "Erro ao criar membership"
- Verifique se a tabela `memberships` existe
- Verifique se há conflito de UNIQUE constraint

## Arquivos Relacionados

- `database/init-minimal-data.sql` - Script SQL manual
- `src/app/api/debug/init-minimal-data/route.ts` - Endpoint de inicialização
- `src/app/debug/init-data/page.tsx` - Interface de inicialização
