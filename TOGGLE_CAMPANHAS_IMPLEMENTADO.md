# Toggle de Campanhas - Implementado ✅

## O que foi feito

Adicionado um **switch (toggle)** na lista de campanhas para ativar/pausar campanhas diretamente do Meta Ads.

## Funcionalidades

### 1. Switch Visual
- ✅ Toggle ON/OFF ao lado de cada campanha
- ✅ Verde quando ACTIVE, cinza quando PAUSED
- ✅ Loading spinner durante a alteração
- ✅ Desabilitado para campanhas ARCHIVED

### 2. API de Alteração de Status
**Arquivo:** `src/app/api/campaigns/[campaignId]/status/route.ts`

**Endpoint:** `PATCH /api/campaigns/[campaignId]/status`

**Body:**
```json
{
  "status": "ACTIVE" | "PAUSED",
  "clientId": "uuid"
}
```

**Funcionalidades:**
- Valida conexão Meta do cliente
- Atualiza status diretamente na Meta API
- Retorna confirmação de sucesso/erro

### 3. Integração na Interface

**Localização:** Lista de Campanhas (primeira aba)

**Comportamento:**
1. Usuário clica no switch
2. Sistema mostra loading spinner
3. Faz chamada para Meta API
4. Atualiza status localmente
5. Mostra toast de confirmação
6. Remove loading

### 4. Estados do Toggle

| Status Atual | Ação do Toggle | Novo Status |
|--------------|----------------|-------------|
| ACTIVE       | Desligar       | PAUSED      |
| PAUSED       | Ligar          | ACTIVE      |
| ARCHIVED     | Desabilitado   | -           |

### 5. Feedback Visual

**Toast de Sucesso:**
```
✅ Status atualizado!
Campanha ativada/pausada com sucesso!
```

**Toast de Erro:**
```
❌ Erro
[Mensagem de erro da API]
```

**Loading State:**
- Spinner no lugar do switch
- Outros switches desabilitados durante operação
- Previne múltiplas alterações simultâneas

## Como Usar

1. Acesse `/dashboard/campaigns`
2. Selecione um cliente
3. Carregue as campanhas
4. Na lista de campanhas, clique no switch ao lado do nome
5. Aguarde a confirmação
6. O status será atualizado automaticamente

## Validações

### Segurança
- ✅ Verifica se cliente tem conexão Meta ativa
- ✅ Valida token de acesso
- ✅ Apenas status ACTIVE e PAUSED permitidos
- ✅ Campanhas arquivadas não podem ser alteradas

### UX
- ✅ Loading visual durante operação
- ✅ Desabilita outros toggles durante alteração
- ✅ Feedback imediato com toast
- ✅ Atualização local sem reload da página
- ✅ Tooltip explicativo no hover

## Código Implementado

### API Route
```typescript
// src/app/api/campaigns/[campaignId]/status/route.ts
export async function PATCH(request, { params }) {
  // 1. Validar parâmetros
  // 2. Buscar conexão Meta
  // 3. Chamar Meta API
  // 4. Retornar resultado
}
```

### Função de Toggle
```typescript
const toggleCampaignStatus = async (campaignId, currentStatus) => {
  setTogglingCampaign(campaignId)
  
  const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
  
  const response = await fetch(`/api/campaigns/${campaignId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: newStatus, clientId })
  })
  
  // Atualizar estado local
  setCampaigns(prev => prev.map(c => 
    c.id === campaignId ? { ...c, status: newStatus } : c
  ))
  
  toast({ title: 'Status atualizado!' })
}
```

### UI Component
```tsx
<Switch
  checked={campaign.status === 'ACTIVE'}
  onCheckedChange={() => toggleCampaignStatus(campaign.id, campaign.status)}
  disabled={togglingCampaign !== null || campaign.status === 'ARCHIVED'}
/>
```

## Tratamento de Erros

### Erros Possíveis

1. **Cliente sem conexão Meta**
   - Mensagem: "Cliente não possui conexão ativa com Meta Ads"
   - Ação: Conectar conta Meta primeiro

2. **Token inválido**
   - Mensagem: "Erro ao atualizar status na Meta API"
   - Ação: Reconectar conta Meta

3. **Campanha não encontrada**
   - Mensagem: "Campanha não encontrada"
   - Ação: Recarregar lista de campanhas

4. **Erro de rede**
   - Mensagem: "Erro interno do servidor"
   - Ação: Tentar novamente

## Melhorias Futuras (Opcional)

- [ ] Confirmação antes de pausar campanha com alto gasto
- [ ] Histórico de alterações de status
- [ ] Pausar múltiplas campanhas de uma vez
- [ ] Agendar ativação/pausa de campanhas
- [ ] Notificação por email quando campanha é pausada

## Testes

### Teste Manual
1. ✅ Ativar campanha pausada
2. ✅ Pausar campanha ativa
3. ✅ Tentar alterar campanha arquivada (deve estar desabilitado)
4. ✅ Verificar loading durante operação
5. ✅ Verificar toast de sucesso
6. ✅ Verificar toast de erro (desconectar Meta)
7. ✅ Verificar atualização do badge de status

### Casos de Teste
```
✅ Toggle ON → OFF: Campanha pausada no Meta
✅ Toggle OFF → ON: Campanha ativada no Meta
✅ Campanha ARCHIVED: Toggle desabilitado
✅ Sem conexão Meta: Erro exibido
✅ Múltiplos toggles: Apenas um por vez
✅ Atualização local: Badge muda imediatamente
```

## Dependências

- `@/components/ui/switch` - Componente Switch do shadcn/ui
- `@/hooks/use-toast` - Hook para exibir toasts
- `lucide-react` - Ícones (Loader2, Power)

## Notas Importantes

⚠️ **Atenção:**
- A alteração é feita diretamente no Meta Ads
- Não há "desfazer" - é necessário clicar novamente
- Campanhas arquivadas não podem ser reativadas
- Requer conexão Meta ativa e válida

✅ **Vantagens:**
- Controle rápido sem sair da página
- Feedback visual imediato
- Sincronização automática com Meta
- Previne erros com validações

---

**Status:** ✅ Implementado e Funcional
**Data:** 2025-01-20
**Versão:** 1.0.0
