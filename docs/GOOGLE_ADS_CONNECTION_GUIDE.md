# Guia de Conexão Google Ads

## Visão Geral

Este guia passo a passo te ajudará a conectar suas contas Google Ads ao sistema de gerenciamento de campanhas. O processo é seguro, rápido e permite que você mantenha controle total sobre suas permissões.

## Pré-requisitos

Antes de começar, certifique-se de que você tem:

✅ **Conta Google Ads ativa** com campanhas criadas  
✅ **Permissões de administrador** na conta Google Ads  
✅ **Acesso à conta Google** associada ao Google Ads  
✅ **Navegador atualizado** (Chrome, Firefox, Safari ou Edge)  

## Passo a Passo Detalhado

### Etapa 1: Acessar a Seção Google Ads

1. **Faça login** no sistema com suas credenciais
2. No **menu lateral esquerdo**, localize e clique em **"Google Ads"**
3. Se esta é sua primeira vez, você verá uma tela de boas-vindas

![Menu Google Ads](screenshots/menu-google-ads.png)

### Etapa 2: Iniciar o Processo de Conexão

1. Clique no botão **"Conectar Google Ads"** (azul, no centro da tela)
2. Uma nova janela ou aba será aberta direcionando para o Google

![Botão Conectar](screenshots/connect-button.png)

⚠️ **Importante**: Não feche esta janela durante o processo de autorização.

### Etapa 3: Autorização no Google

#### 3.1 Login na Conta Google

1. **Digite seu email** da conta Google que tem acesso ao Google Ads
2. **Digite sua senha**
3. Complete a **autenticação em duas etapas** se habilitada

![Login Google](screenshots/google-login.png)

#### 3.2 Revisar Permissões

O sistema solicitará as seguintes permissões:

| Permissão | Para que serve |
|-----------|----------------|
| **Ver suas campanhas Google Ads** | Importar lista de campanhas e dados básicos |
| **Ver métricas de performance** | Obter dados de impressões, cliques, conversões |
| **Acessar informações da conta** | Identificar contas disponíveis para conexão |

![Permissões Google](screenshots/google-permissions.png)

#### 3.3 Autorizar Acesso

1. **Revise cuidadosamente** as permissões solicitadas
2. Clique em **"Permitir"** para autorizar o acesso
3. Aguarde o redirecionamento automático

### Etapa 4: Seleção de Contas Google Ads

#### 4.1 Visualizar Contas Disponíveis

Após a autorização, você verá uma lista das contas Google Ads disponíveis:

![Seleção de Contas](screenshots/account-selection.png)

#### 4.2 Selecionar Contas para Conectar

1. **Marque as caixas** das contas que deseja conectar
2. Você pode conectar **múltiplas contas** se necessário
3. Verifique os **IDs das contas** para confirmar que são as corretas

**Informações exibidas para cada conta:**
- **Nome da conta**: Nome configurado no Google Ads
- **ID da conta**: Identificador único (ex: 123-456-7890)
- **Status**: Ativa, Suspensa, etc.
- **Moeda**: Moeda padrão da conta (BRL, USD, etc.)

#### 4.3 Confirmar Seleção

1. Após selecionar as contas desejadas
2. Clique em **"Conectar Contas Selecionadas"**
3. Aguarde a confirmação da conexão

### Etapa 5: Sincronização Inicial

#### 5.1 Processo Automático

Após conectar as contas, o sistema iniciará automaticamente:

1. **Importação de campanhas** de cada conta conectada
2. **Sincronização de métricas** dos últimos 30 dias
3. **Configuração de sincronização automática**

![Sincronização](screenshots/sync-progress.png)

#### 5.2 Acompanhar Progresso

Durante a sincronização, você verá:
- **Barra de progresso** com percentual concluído
- **Número de campanhas** sendo processadas
- **Tempo estimado** para conclusão
- **Status atual** da operação

#### 5.3 Conclusão da Sincronização

Quando a sincronização for concluída:
- Você será **redirecionado automaticamente** para o dashboard Google Ads
- Receberá uma **notificação de sucesso**
- Poderá visualizar suas **campanhas importadas**

## Verificação da Conexão

### Status da Conexão

Após a conexão bem-sucedida, verifique:

1. **Indicador de status** no canto superior direito:
   - 🟢 **Verde**: Conectado e funcionando
   - 🟡 **Amarelo**: Atenção necessária
   - 🔴 **Vermelho**: Desconectado ou com erro

2. **Informações da conta** no painel lateral:
   - Nome da conta conectada
   - ID da conta
   - Data da última sincronização

![Status Conectado](screenshots/connection-status.png)

### Teste de Funcionalidade

Para confirmar que tudo está funcionando:

1. **Verifique se as campanhas** aparecem na lista
2. **Confirme se as métricas** estão sendo exibidas
3. **Teste a sincronização manual** clicando no botão "Sincronizar"

## Conectando Múltiplas Contas

### Quando Usar

Conecte múltiplas contas Google Ads quando:
- Você gerencia **campanhas para diferentes clientes**
- Tem **contas separadas por região** ou produto
- Precisa de **relatórios consolidados** de várias contas

### Como Conectar Contas Adicionais

1. No dashboard Google Ads, clique em **"Gerenciar Conexões"**
2. Clique em **"Adicionar Nova Conta"**
3. Repita o processo de autorização
4. Selecione as novas contas para conectar

![Múltiplas Contas](screenshots/multiple-accounts.png)

### Alternando Entre Contas

Para alternar entre contas conectadas:
1. Use o **seletor de contas** no topo do dashboard
2. Ou acesse **"Configurações" > "Contas Conectadas"**
3. Clique na conta que deseja visualizar

## Gerenciamento de Permissões

### Permissões Mínimas Necessárias

Para funcionar corretamente, o sistema precisa de:

| Nível | Permissões |
|-------|------------|
| **Mínimo** | Visualizar campanhas e métricas básicas |
| **Recomendado** | Acesso completo de leitura às contas |
| **Avançado** | Permissões de edição (futuras funcionalidades) |

### Modificando Permissões

Para alterar permissões após a conexão:

1. Acesse [myaccount.google.com](https://myaccount.google.com)
2. Vá para **"Segurança" > "Aplicativos conectados"**
3. Encontre o aplicativo do sistema
4. Clique em **"Gerenciar acesso"**
5. Modifique ou revogue as permissões conforme necessário

## Solução de Problemas Comuns

### Problema 1: "Conta não encontrada"

**Sintomas:**
- Não vê suas contas Google Ads na lista de seleção
- Mensagem "Nenhuma conta encontrada"

**Soluções:**
1. ✅ Confirme que está logado na **conta Google correta**
2. ✅ Verifique se tem **acesso administrativo** à conta Google Ads
3. ✅ Certifique-se de que a conta Google Ads está **ativa**
4. ✅ Aguarde alguns minutos e tente novamente

### Problema 2: "Erro de autorização"

**Sintomas:**
- Erro durante o processo de OAuth
- Redirecionamento falha
- Mensagem "Acesso negado"

**Soluções:**
1. ✅ **Limpe o cache** do navegador
2. ✅ **Desabilite bloqueadores** de pop-up temporariamente
3. ✅ Tente usar um **navegador diferente**
4. ✅ Verifique se não há **extensões interferindo**

### Problema 3: "Sincronização falha"

**Sintomas:**
- Campanhas não aparecem após conexão
- Métricas não são carregadas
- Erro durante sincronização inicial

**Soluções:**
1. ✅ Aguarde **5-10 minutos** e recarregue a página
2. ✅ Clique em **"Sincronizar Manualmente"**
3. ✅ Verifique se as campanhas estão **ativas no Google Ads**
4. ✅ Entre em contato com o suporte se persistir

### Problema 4: "Token expirado"

**Sintomas:**
- Indicador vermelho de conexão
- Mensagem "Reconexão necessária"
- Dados não atualizam

**Soluções:**
1. ✅ Clique em **"Reconectar"** no dashboard
2. ✅ Siga novamente o processo de autorização
3. ✅ Seus dados históricos serão preservados

## Segurança e Privacidade

### Proteção de Dados

O sistema garante:
- 🔒 **Criptografia** de todos os tokens de acesso
- 🔒 **Isolamento** completo entre diferentes clientes
- 🔒 **Acesso limitado** apenas aos dados necessários
- 🔒 **Logs de auditoria** de todas as operações

### Revogação de Acesso

Para revogar o acesso a qualquer momento:

**Pelo Sistema:**
1. Vá para **"Configurações" > "Integrações"**
2. Clique em **"Desconectar"** na conta Google Ads
3. Confirme a ação

**Pelo Google:**
1. Acesse [myaccount.google.com](https://myaccount.google.com)
2. Vá para **"Segurança" > "Aplicativos conectados"**
3. Encontre o aplicativo e clique em **"Remover acesso"**

### Boas Práticas de Segurança

- ✅ **Revise regularmente** as permissões concedidas
- ✅ **Use autenticação em duas etapas** na conta Google
- ✅ **Monitore atividades** suspeitas nas contas
- ✅ **Mantenha senhas seguras** e atualizadas

## Próximos Passos

Após conectar com sucesso suas contas Google Ads:

1. 📊 **Explore o dashboard** e familiarize-se com as métricas
2. 📈 **Configure alertas** para monitorar performance
3. 📋 **Gere seu primeiro relatório** para análise
4. 🎯 **Defina metas** e KPIs para acompanhamento
5. 📚 **Leia o guia completo** do usuário para funcionalidades avançadas

## Suporte Adicional

### Recursos de Ajuda

- 📖 **Documentação completa**: Guia do usuário detalhado
- 🎥 **Vídeos tutoriais**: Passo a passo visual
- ❓ **FAQ**: Perguntas frequentes
- 💬 **Chat de suporte**: Ajuda em tempo real

### Contato

**Precisa de ajuda?**
- 📧 Email: suporte@seudominio.com
- 📞 Telefone: (11) 1234-5678
- 💬 Chat: Disponível no sistema 24/7

---

**Parabéns!** 🎉 Você conectou com sucesso suas contas Google Ads. Agora você pode aproveitar todos os recursos de análise e monitoramento disponíveis no sistema.