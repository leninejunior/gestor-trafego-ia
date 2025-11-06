# Como Obter Dados Reais da sua MCC Google Ads

## Status Atual
✅ **API implementada** - A API está pronta para buscar dados reais
✅ **Estrutura funcionando** - O sistema pode processar múltiplas contas MCC
❌ **Tokens reais necessários** - Precisa de tokens OAuth reais da sua conta

## Para Obter Dados Reais da sua MCC:

### 1. Verificar Developer Token
Primeiro, verifique se seu Developer Token está aprovado:
- Acesse [Google Ads API Center](https://ads.google.com/nav/selectaccount?authuser=0&dst=/aw/apicenter)
- Verifique se o status é "APPROVED" (não "PENDING")
- Se estiver pendente, você só pode acessar contas de teste

### 2. Fazer OAuth Real
Execute o fluxo OAuth completo no navegador:

1. **Acesse**: http://localhost:3000/dashboard/clients
2. **Clique em**: "Conectar Google Ads" 
3. **Faça login**: Com sua conta Google que tem acesso à MCC
4. **Autorize**: Todas as permissões solicitadas
5. **Complete**: O fluxo até a seleção de contas

### 3. Verificar Tokens Salvos
Após o OAuth, execute este script para verificar:
```bash
node scripts/test-google-token-manager.js
```

### 4. Testar API Real
Com tokens reais, teste a API:
```bash
node scripts/test-real-google-accounts-api.js
```

## Problemas Comuns:

### Developer Token Pendente
- **Sintoma**: Erro 404 ou "Customer not found"
- **Solução**: Aguardar aprovação do Google (pode levar dias)
- **Alternativa**: Usar conta de teste do Google Ads

### Permissões Insuficientes
- **Sintoma**: Erro 403 "Permission denied"
- **Solução**: Verificar se a conta tem acesso à MCC
- **Verificar**: Se o usuário é admin/manager da MCC

### Token Expirado
- **Sintoma**: Erro 401 "Unauthorized"
- **Solução**: Refazer o fluxo OAuth
- **Automático**: O sistema deveria renovar automaticamente

## Estrutura da Resposta Real

Quando funcionando, você verá algo assim:
```json
{
  "connectionId": "uuid-da-conexao",
  "accounts": [
    {
      "customerId": "1234567890",
      "descriptiveName": "Nome Real da Conta",
      "currencyCode": "BRL",
      "timeZone": "America/Sao_Paulo",
      "canManageClients": true
    }
  ],
  "totalAccounts": 5,
  "isPending": true,
  "isMCC": true,
  "hasTokens": true,
  "isReal": true,
  "message": "5 contas encontradas na sua MCC"
}
```

## Próximos Passos

1. **Execute o OAuth real** com sua conta MCC
2. **Verifique se obtém tokens válidos**
3. **Teste a API** - deve retornar `"isReal": true`
4. **Selecione as contas** que deseja conectar
5. **Aproveite os dados reais** da sua MCC!

## Debug

Se ainda não funcionar, verifique:
- Developer Token aprovado
- Conta tem acesso à MCC
- Tokens não expirados
- Variáveis de ambiente corretas

Execute os scripts de teste para diagnosticar problemas específicos.