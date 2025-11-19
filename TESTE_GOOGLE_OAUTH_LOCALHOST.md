# 🧪 Teste do Fluxo OAuth Google Ads - Localhost

## Pré-requisitos

1. ✅ Servidor de desenvolvimento rodando (`pnpm dev`)
2. ✅ Google Cloud Console configurado com redirect URI: `http://localhost:3000/api/google/callback-verbose`
3. ✅ Variáveis de ambiente configuradas no `.env`

## Passo a Passo

### 1. Iniciar o servidor de desenvolvimento

```bash
pnpm dev
```

### 2. Acessar a página de clientes

Abra o navegador em: `http://localhost:3000/dashboard/clients`

### 3. Selecionar um cliente e clicar em "Conectar Google Ads"

Ou acesse diretamente a API de auth com um clientId válido:

```
http://localhost:3000/api/google/auth?clientId=SEU_CLIENT_ID_AQUI
```

### 4. Autorizar no Google

- Faça login com sua conta Google
- Autorize o acesso ao Google Ads
- Você será redirecionado para o callback verbose

### 5. Analisar os logs

O callback verbose mostrará:
- ✅ Todos os parâmetros recebidos
- ✅ Validação do state
- ✅ Troca de tokens
- ✅ Criação da conexão no banco
- ✅ Logs detalhados de cada etapa

### 6. Verificar no banco

Execute o script de verificação:

```bash
node scripts/verificar-conexao-google.js
```

## Endpoints Disponíveis

### Callback Verbose (para debug)
```
http://localhost:3000/api/google/callback-verbose
```

### Callback Normal (produção)
```
http://localhost:3000/api/google/callback
```

### Debug OAuth Status
```
http://localhost:3000/api/google/debug-oauth-status?state=SEU_STATE_AQUI
```

## Troubleshooting

### Erro: "redirect_uri_mismatch"

Verifique se o redirect URI está configurado no Google Cloud Console:
1. Acesse https://console.cloud.google.com/
2. APIs & Services > Credentials
3. Edite o OAuth 2.0 Client ID
4. Adicione: `http://localhost:3000/api/google/callback-verbose`

### Erro: "State inválido ou expirado"

O state expira em 10 minutos. Inicie um novo fluxo OAuth.

### Erro: "Conexão não criada"

Verifique:
1. Se o usuário está autenticado
2. Se o clientId é válido
3. Se as permissões do banco estão corretas (RLS)

## Logs do Console

Abra o DevTools (F12) e vá para a aba Console para ver logs adicionais.

## Próximos Passos

Após o OAuth funcionar em localhost:
1. Fazer deploy para produção
2. Atualizar redirect URI no Google Cloud Console para produção
3. Testar em produção
