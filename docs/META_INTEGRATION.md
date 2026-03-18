# Integração Meta Ads - Sistema Completo

## 📋 Visão Geral
Sistema completo de integração com Meta Ads (Facebook Ads) para gerenciamento de campanhas publicitárias de múltiplos clientes com **isolamento total de dados**.

## ✅ Funcionalidades Implementadas

### 1. 🔐 Autenticação OAuth 2.0
- Fluxo completo de autorização com Meta
- Gerenciamento seguro de tokens de acesso
- Renovação automática de tokens
- Suporte a múltiplos clientes por usuário

### 2. 🎯 Seleção de Contas
- Interface para escolher contas de anúncios específicas
- Suporte a múltiplas contas por cliente
- Visualização de informações das contas (nome, moeda, etc.)
- **Isolamento completo entre clientes**

### 3. 🔗 Gerenciamento de Conexões
- Conectar/desconectar contas Meta Ads por cliente
- Visualizar status das conexões
- Reconectar contas quando necessário
- Remover conexões individuais ou todas de uma vez
- **ISOLAMENTO GARANTIDO**: Cada cliente tem suas próprias conexões

### 4. 📊 Campanhas e Insights
- Listagem de campanhas ativas por cliente
- Métricas de performance (impressões, cliques, gastos)
- Dados em tempo real via Meta Marketing API
- Histórico de insights por campanha

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais
```sql
organizations          -- Organizações dos usuários
├── memberships        -- Relacionamento usuário-organização  
├── clients           -- Clientes da agência
│   └── client_meta_connections  -- Conexões Meta Ads (ISOLADAS por cliente)
│       └── meta_campaigns       -- Campanhas por conexão
│           └── meta_campaign_insights  -- Métricas das campanhas
```

### 🔒 Isolamento de Dados
```
Usuário A:
├── Organização A
    ├── Cliente A1 → Conexões Meta do Cliente A1
    ├── Cliente A2 → Conexões Meta do Cliente A2
    └── Cliente A3 → Conexões Meta do Cliente A3

Usuário B:
├── Organização B
    ├── Cliente B1 → Conexões Meta do Cliente B1
    └── Cliente B2 → Conexões Meta do Cliente B2
```

**IMPORTANTE**: Reconectar Cliente A1 NÃO afeta conexões dos Clientes A2, A3, B1, B2, etc.

### Constraint de Isolamento
```sql
UNIQUE(client_id, ad_account_id)  -- Garante isolamento por cliente
```

## 🚀 APIs Implementadas

### Autenticação
- `GET /api/meta/auth?clientId=X` - Gerar URL de autorização para cliente específico
- `GET /api/meta/callback` - Processar callback OAuth

### Contas e Conexões
- `GET /api/meta/accounts` - Listar contas disponíveis
- `POST /api/meta/save-selected` - Salvar contas selecionadas para cliente específico
- `DELETE /api/meta/connections/[id]` - Remover conexão específica
- `DELETE /api/meta/connections/clear-all?clientId=X` - Remover todas as conexões do cliente

### Campanhas e Dados
- `GET /api/meta/campaigns?clientId=X` - Listar campanhas do cliente
- `GET /api/meta/insights?clientId=X` - Obter métricas do cliente

### 🧪 APIs de Debug (Desenvolvimento)
- `GET /api/debug/user-data` - Visualizar estrutura de dados
- `POST /api/test/delete-connection` - Testar operações DELETE
- `GET /api/test/isolation` - Verificar isolamento entre clientes

## 🎨 Componentes UI

### Principais
- `ConnectMetaButton`: Botão para iniciar conexão por cliente
- `ManageConnections`: Gerenciar conexões existentes do cliente
- `CampaignsList`: Listar campanhas e métricas por cliente
- `SelectAccountsPage`: Página de seleção de contas

### Páginas de Debug (Desenvolvimento)
- `/debug` - Visualizar dados e estrutura
- `/test-delete` - Testar operações DELETE com segurança

## ⚙️ Configuração

### Variáveis de Ambiente
```env
# Meta Ads API
META_APP_ID=seu_app_id
META_APP_SECRET=seu_app_secret
META_ACCESS_TOKEN=seu_token_de_acesso

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=sua_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_supabase
```

### Permissões Meta Necessárias
- `ads_management` - Gerenciar campanhas
- `ads_read` - Ler dados de campanhas
- `business_management` - Acessar contas de negócios

## 📱 Fluxo de Uso

### 1. Conectar Cliente
```
1. Ir para página do cliente específico
2. Clicar em "Conectar Meta Ads"
3. Autorizar no Meta (redirecionamento)
4. Selecionar contas desejadas para ESTE cliente
5. Confirmar seleção
```

### 2. Gerenciar Conexões
```
1. Visualizar contas conectadas do cliente
2. Remover conexões individuais (só deste cliente)
3. Limpar todas as conexões (só deste cliente)
4. Reconectar quando necessário (só afeta este cliente)
```

### 3. Visualizar Campanhas
```
1. Acessar dados de campanhas do cliente
2. Ver métricas de performance isoladas
3. Monitorar gastos e resultados por cliente
```

## 🔒 Segurança e Isolamento

### Row Level Security (RLS)
```sql
-- Políticas implementadas para isolamento total
CREATE POLICY "Users can view their own client meta connections" 
ON client_meta_connections FOR SELECT USING (
    client_id IN (
        SELECT c.id FROM clients c
        JOIN memberships m ON c.org_id = m.org_id
        WHERE m.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete their own client meta connections"
ON client_meta_connections FOR DELETE USING (
    client_id IN (
        SELECT c.id FROM clients c
        JOIN memberships m ON c.org_id = m.org_id
        WHERE m.user_id = auth.uid()
    )
);
```

### Validações de Segurança
- ✅ Verificação de permissões em todas as APIs
- ✅ Isolamento por `client_id` em todas as operações
- ✅ Sanitização de dados de entrada
- ✅ Logs detalhados para auditoria
- ✅ Verificação de `org_id` via `memberships`

### Garantias de Isolamento
- ✅ **Cada cliente tem suas próprias conexões**
- ✅ **Operações em um cliente não afetam outros**
- ✅ **Mesmo ad_account_id pode existir para clientes diferentes**
- ✅ **DELETE/UPDATE só afeta o cliente específico**

## 🔧 Troubleshooting

### Problemas Comuns e Soluções

#### 1. Token Expirado
**Sintoma**: Erro 401 ou dados não carregam
**Solução**: Reconectar conta do cliente específico

#### 2. Conexão não Remove
**Sintoma**: DELETE retorna sucesso mas conexão permanece
**Solução**: Verificar se políticas RLS foram aplicadas
```sql
-- Verificar políticas existentes
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'client_meta_connections';
```

#### 3. Dados de Cliente Errado
**Sintoma**: Vendo campanhas de outro cliente
**Solução**: Verificar isolamento
```
GET /api/test/isolation  -- Para verificar isolamento
```

#### 4. Permissões Insuficientes
**Sintoma**: Erro 403 ou "sem permissão"
**Solução**: Verificar scopes no Meta e membership do usuário

### 🔍 Logs e Debug
- **Frontend**: Console do navegador para erros de UI
- **Backend**: Logs do servidor para debugging de APIs
- **Database**: Supabase logs para problemas de RLS
- **Debug Tools**: `/debug` e `/test-delete` para diagnóstico

## 📈 Próximos Passos

### Melhorias Planejadas
- [ ] Cache de dados para melhor performance
- [ ] Webhooks para atualizações em tempo real
- [ ] Relatórios avançados por cliente
- [ ] Automação de campanhas
- [ ] Integração com Google Ads
- [ ] Dashboard consolidado multi-cliente
- [ ] Alertas e notificações

### Limpeza Pós-Desenvolvimento
- [ ] Remover APIs de debug (`/api/debug/*`, `/api/test/*`)
- [ ] Remover páginas de teste (`/debug`, `/test-delete`)
- [ ] Remover links de debug da sidebar
- [ ] Manter documentação e scripts SQL para referência

## 📞 Suporte

### Para Problemas
1. **Verificar logs** do navegador e servidor
2. **Usar ferramentas de debug** (`/debug`, `/test-delete`)
3. **Consultar esta documentação**
4. **Verificar políticas RLS** no Supabase
5. **Testar isolamento** com `/api/test/isolation`

### Arquivos de Referência
- `SUCCESS_SUMMARY.md` - Resumo das correções aplicadas
- `DEBUG_TOOLS.md` - Como usar ferramentas de debug
- `database/check-rls-policies.sql` - Scripts de verificação
- `APPLY_RLS_FIX.md` - Histórico de correções RLS

---

## ✅ Status do Sistema
**Sistema 100% funcional e pronto para produção**
- ✅ Isolamento de dados garantido
- ✅ Operações DELETE funcionando
- ✅ Políticas RLS aplicadas
- ✅ Todas as correções testadas e validadas

---

## 🚀 Configuração Inicial (Para Novos Projetos)

### 1. Criar App no Meta for Developers

1. **Acesse:** [Meta for Developers](https://developers.facebook.com/)
2. **Faça login** com sua conta Facebook/Meta
3. **Clique em "Meus Apps"** no canto superior direito
4. **Clique em "Criar App"**
5. **Selecione o tipo:** "Empresa" ou "Consumidor"
6. **Preencha os dados:**
   - **Nome do App:** "Ads Manager" (ou o nome que preferir)
   - **Email de contato:** seu email
   - **Categoria:** "Negócios e páginas"
7. **Clique em "Criar App"**

### 1.1. Adicionar Marketing API

1. **No painel do app**, procure por "Marketing API"
2. **Clique em "Configurar"** no card da Marketing API
3. **Aceite os termos** se solicitado

### 1.2. Adicionar Facebook Login (Obrigatório)

1. **No painel do seu app**, vá para a seção **"Produtos"** (Products)
2. **Clique em "+ Adicionar produto"** ou **"Add Product"**
3. **Procure por "Facebook Login"**
4. **Clique em "Configurar"** no card do Facebook Login
5. **Aceite os termos** se solicitado

### 1.3. Configurar URLs de Callback

#### Configurar Facebook Login
1. **Após adicionar Facebook Login**, vá para **"Produtos" > "Facebook Login" > "Configurações"**
2. **Procure por "URIs de redirecionamento OAuth válidos"**
3. **Adicione a URL:**
   ```
   http://localhost:3000/api/meta/callback
   ```
4. **Clique em "Salvar alterações"**

#### Configurar Domínios do App
1. **Vá para "Configurações do App" > "Básico"**
2. **Role para baixo até "Domínios do App"**
3. **Adicione:** `localhost`
4. **Salve as alterações**

### 2. Configurar Banco de Dados

Execute o script SQL completo no seu Supabase:

1. **Acesse o Supabase SQL Editor**
2. **Abra o arquivo `database/complete-schema.sql`**
3. **Copie todo o conteúdo**
4. **Cole no SQL Editor do Supabase**
5. **Clique em "Run"**

### 3. Aplicar Políticas RLS

Execute no Supabase SQL Editor:
```sql
-- Aplicar políticas de segurança
CREATE POLICY "Users can delete their own client meta connections"
ON client_meta_connections FOR DELETE USING (
    client_id IN (
        SELECT c.id FROM clients c
        JOIN memberships m ON c.org_id = m.org_id
        WHERE m.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own client meta connections"
ON client_meta_connections FOR UPDATE USING (
    client_id IN (
        SELECT c.id FROM clients c
        JOIN memberships m ON c.org_id = m.org_id
        WHERE m.user_id = auth.uid()
    )
);
```

---

#
# ⚠️ IMPORTANTE: Padrões de Código

### 1. Next.js 15 - Supabase Client (SEMPRE use await!)
```typescript
// ❌ ERRADO - Causa erro "Cannot read properties of undefined (reading 'getUser')"
export async function POST(request: NextRequest) {
  const supabase = createClient(); // ERRO!
  const { data: { user } } = await supabase.auth.getUser();
}

// ✅ CORRETO - Next.js 15 requer await
export async function POST(request: NextRequest) {
  const supabase = await createClient(); // CORRETO!
  const { data: { user } } = await supabase.auth.getUser();
}
```

### 2. Tabela client_meta_connections - Nomes Corretos
```typescript
// ❌ ERRADO - Coluna não existe no banco
const connection = {
  client_id: clientId,
  ad_account_id: accountId,
  ad_account_name: 'Nome',  // ❌ COLUNA ERRADA!
  status: 'active'           // ❌ COLUNA ERRADA!
};

// ✅ CORRETO - Nomes reais das colunas
const connection = {
  client_id: clientId,
  ad_account_id: accountId,
  account_name: 'Nome',      // ✅ CORRETO!
  is_active: true            // ✅ CORRETO!
};
```

### 3. Schema da Tabela client_meta_connections
```sql
CREATE TABLE client_meta_connections (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  ad_account_id TEXT NOT NULL,
  account_name TEXT,           -- ⚠️ NÃO é "ad_account_name"!
  access_token TEXT NOT NULL,
  currency TEXT DEFAULT 'BRL',
  is_active BOOLEAN DEFAULT true,  -- ⚠️ NÃO é "status"!
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(client_id, ad_account_id)
);
```

### 4. Exemplo Completo de Rota API
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, access_token, selected_accounts, ad_accounts } = body;

    // ✅ SEMPRE use await com createClient()
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // ✅ Usar nomes corretos das colunas
    const connections = selected_accounts.map((accountId: string) => {
      const account = ad_accounts.find((acc: any) => acc.id === accountId);
      return {
        client_id,
        ad_account_id: accountId,
        account_name: account?.name || 'Unknown',  // ✅ account_name
        access_token,
        is_active: true  // ✅ is_active
      };
    });

    const { data, error } = await supabase
      .from('client_meta_connections')
      .insert(connections)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, connections: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

## 🐛 Erros Comuns e Soluções

### Erro: "Cannot read properties of undefined (reading 'getUser')"
**Causa:** Faltou `await` no `createClient()`
**Solução:** Sempre use `const supabase = await createClient();`

### Erro: "Could not find the 'ad_account_name' column"
**Causa:** Nome da coluna errado
**Solução:** Use `account_name` ao invés de `ad_account_name`

### Erro: "Could not find the 'status' column"
**Causa:** Nome da coluna errado
**Solução:** Use `is_active` (boolean) ao invés de `status` (string)
