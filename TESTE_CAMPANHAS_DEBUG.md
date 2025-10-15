# 🔍 Sistema de Debug para Campanhas Meta Ads

## ✅ Implementações Realizadas

### 1. API de Campanhas com Logs Detalhados
- **Arquivo**: `src/app/api/meta/campaigns/route.ts`
- **Funcionalidades**:
  - Logs detalhados em cada etapa do processo
  - Dados de teste quando não há campanhas reais
  - Tratamento de erros com fallback para dados de teste
  - Identificação clara de dados reais vs. dados de teste

### 2. Componente de Lista com Debug
- **Arquivo**: `src/components/meta/campaigns-list.tsx`
- **Funcionalidades**:
  - Logs detalhados no console do navegador
  - Exibição de mensagens informativas para dados de teste
  - Melhor tratamento de erros e estados de loading

### 3. Dados de Teste Incluídos
```javascript
const testCampaigns = [
  {
    id: 'test_campaign_1',
    name: 'Campanha de Teste - Vendas Q4',
    status: 'ACTIVE',
    objective: 'CONVERSIONS',
    spend: '1250.50',
    impressions: '45000',
    clicks: '890',
    ctr: '1.98',
    cpc: '1.40',
    created_time: '2024-01-15T10:00:00Z'
  },
  // ... mais campanhas de teste
];
```

## 🧪 Como Testar

### Passo 1: Acesse o Sistema
- URL: `http://localhost:3001`
- Faça login no sistema

### Passo 2: Navegue até o Cliente
- Vá para **Dashboard > Clientes**
- Selecione "Coan Consultoria" (ou qualquer cliente)

### Passo 3: Teste as Campanhas
- Na página do cliente, role até a seção "Campanhas Meta Ads"
- Clique no botão **"Atualizar"** ou aguarde o carregamento automático

### Passo 4: Verifique os Logs
- Abra o **Console do Navegador** (F12 > Console)
- Procure por logs que começam com:
  - `🚀 [CAMPAIGNS LIST]`
  - `🔍 [CAMPAIGNS API]`
  - `✅ [CAMPAIGNS API]`
  - `🧪 [CAMPAIGNS API]`

### Passo 5: Verifique o Terminal
- No terminal onde o sistema está rodando
- Procure por logs detalhados da API

## 📊 O Que Esperar

### Cenário 1: Sem Conexão Meta
- **Resultado**: Dados de teste serão exibidos
- **Logs**: `⚠️ [CAMPAIGNS API] Conexão não encontrada, retornando dados de teste`
- **Interface**: Toast informativo sobre dados de teste

### Cenário 2: Com Conexão Meta (mas erro na API)
- **Resultado**: Dados de teste como fallback
- **Logs**: `❌ [CAMPAIGNS API] Erro ao buscar campanhas reais`
- **Interface**: Campanhas de teste com aviso

### Cenário 3: Com Conexão Meta (sucesso)
- **Resultado**: Campanhas reais do Meta
- **Logs**: `✅ [CAMPAIGNS API] Campanhas reais obtidas`
- **Interface**: Campanhas reais sem avisos

## 🔧 Logs Detalhados Implementados

### No Console do Navegador:
```
🚀 [CAMPAIGNS LIST] Iniciando busca de campanhas...
📋 [CAMPAIGNS LIST] Parâmetros: {clientId: "...", adAccountId: "..."}
🔗 [CAMPAIGNS LIST] URL da requisição: /api/meta/campaigns?clientId=...
📊 [CAMPAIGNS LIST] Resposta da API: {status: 200, data: {...}, isTestData: true}
🧪 [CAMPAIGNS LIST] Dados de teste carregados
🏁 [CAMPAIGNS LIST] Busca finalizada
```

### No Terminal do Servidor:
```
🔍 [CAMPAIGNS API] Iniciando busca de campanhas...
📋 [CAMPAIGNS API] Parâmetros recebidos: {clientId: "...", adAccountId: "..."}
✅ [CAMPAIGNS API] Cliente Supabase criado
✅ [CAMPAIGNS API] Usuário autenticado: user@example.com
🔍 [CAMPAIGNS API] Buscando conexão Meta...
📊 [CAMPAIGNS API] Resultado da busca de conexão: {connection: null, connectionError: {...}}
⚠️ [CAMPAIGNS API] Conexão não encontrada, retornando dados de teste
🧪 [CAMPAIGNS API] Dados de teste: [{...}, {...}, {...}]
```

## 🎯 Próximos Passos

1. **Execute o teste** seguindo os passos acima
2. **Copie os logs** do console e terminal
3. **Relate o resultado** - se as campanhas de teste aparecem
4. **Identifique o problema** com base nos logs detalhados

## 📝 Informações Importantes

- O sistema agora **SEMPRE** retorna dados (reais ou de teste)
- Os logs permitem identificar exatamente onde está o problema
- Os dados de teste são realistas e permitem testar a interface
- A API nunca falha - sempre retorna algo para exibir

---

**Status**: ✅ Implementado e pronto para teste
**Próximo**: Aguardando feedback do teste para identificar o problema específico