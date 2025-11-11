# Interface de Alertas de Saldo - Atualizada

## ✅ Problema Resolvido

A página de alertas agora **lista todas as contas Meta Ads conectadas** e permite criar alertas para cada uma delas.

## 🎯 O Que Foi Implementado

### 1. Sistema de Abas
A interface agora possui 2 abas principais:

#### **Aba 1: Contas Conectadas**
- Lista **todas as contas Meta Ads** conectadas no sistema
- Mostra informações de cada conta:
  - Nome do cliente
  - Nome da conta de anúncio
  - ID da conta (com ícone do Facebook)
  - Saldo atual
  - Status do alerta (se já tem ou não)
- Botão "Criar Alerta" para contas sem alerta configurado
- Busca e filtros para encontrar contas específicas

#### **Aba 2: Alertas Configurados**
- Lista todos os alertas já configurados
- Permite gerenciar alertas existentes:
  - Ativar/desativar alertas
  - Editar configurações
  - Excluir alertas
  - Ver status e saldo atual
- Filtros por status e tipo de alerta

## 📊 Funcionalidades

### Visualização de Contas
```
┌─────────────────────────────────────────────────────────┐
│ Contas Conectadas (X)                                   │
├─────────────────────────────────────────────────────────┤
│ Cliente    │ Conta         │ Saldo    │ Status         │
│ Empresa A  │ Conta Ads 1   │ R$ 500   │ [Criar Alerta]│
│ Empresa B  │ Conta Ads 2   │ R$ 1.200 │ ✓ Alerta Ativo│
└─────────────────────────────────────────────────────────┘
```

### Criação Rápida de Alertas
- Clique em "Criar Alerta" na conta desejada
- Alerta criado automaticamente com valores padrão:
  - Limite: R$ 100,00
  - Tipo: Saldo Baixo
  - Status: Ativo

### Gerenciamento de Alertas
- Switch para ativar/desativar
- Botões para editar e excluir
- Visualização do status atual (Normal/Atenção/Crítico)
- Indicador de dias restantes estimados

## 🔧 APIs Utilizadas

### GET /api/admin/balance/accounts
Retorna todas as contas Meta Ads conectadas:
```json
{
  "accounts": [
    {
      "client_id": "uuid",
      "client_name": "Nome do Cliente",
      "ad_account_id": "act_123456",
      "ad_account_name": "Conta de Anúncios",
      "balance": 500.00,
      "status": "active",
      "has_alert": false
    }
  ]
}
```

### GET /api/admin/balance/alerts
Retorna todos os alertas configurados

### POST /api/admin/balance/alerts
Cria um novo alerta para uma conta

## 🎨 Interface Atualizada

### Componentes Adicionados
- `Tabs` - Sistema de abas
- `TabsList` - Lista de abas
- `TabsContent` - Conteúdo de cada aba
- Ícones: `Plus`, `AlertCircle`, `Facebook`

### Melhorias Visuais
- Badges coloridos para status
- Ícones do Facebook nas contas
- Botões de ação contextuais
- Mensagens informativas quando não há dados
- Loading states para melhor UX

## 📍 Como Usar

1. **Acesse a página**: `/dashboard/balance-alerts`

2. **Veja suas contas**:
   - Clique na aba "Contas Conectadas"
   - Todas as contas Meta Ads aparecerão listadas

3. **Crie um alerta**:
   - Encontre a conta desejada
   - Clique em "Criar Alerta"
   - O alerta será criado automaticamente

4. **Gerencie alertas**:
   - Clique na aba "Alertas Configurados"
   - Use os switches para ativar/desativar
   - Use os botões para editar ou excluir

## 🔍 Filtros e Busca

### Busca Global
- Busca por nome do cliente
- Busca por nome da conta
- Busca por ID da conta

### Filtros (Aba de Alertas)
- **Status**: Normal, Atenção, Crítico
- **Tipo**: Saldo Baixo, Saldo Crítico, Saldo Zerado

## ✨ Próximos Passos

1. **Edição de Alertas**: Implementar modal para editar limites e tipos
2. **Sincronização Manual**: Botão para atualizar saldo de uma conta específica
3. **Histórico**: Ver histórico de alertas disparados
4. **Notificações**: Configurar canais de notificação (WhatsApp, Email)

## 🎯 Resultado

Agora você pode:
- ✅ Ver todas as contas Meta Ads conectadas
- ✅ Criar alertas rapidamente
- ✅ Gerenciar alertas existentes
- ✅ Filtrar e buscar contas/alertas
- ✅ Ver status e saldos em tempo real

**A interface está completa e funcional!** 🚀
