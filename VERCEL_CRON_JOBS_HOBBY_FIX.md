# 🔧 Correção dos Cron Jobs para Vercel Hobby

## ❌ Problema Identificado

O Vercel Hobby (plano gratuito) tem limitações nos cron jobs:
- **Limitação**: Apenas cron jobs que executam **uma vez por dia**
- **Erro**: `*/5 * * * *` (a cada 5 minutos) não é permitido
- **Solução**: Ajustar para execução diária

## ✅ Correção Aplicada

### Arquivo `vercel.json` (Plano Hobby)
```json
{
  "crons": [
    {
      "path": "/api/cron/billing",
      "schedule": "0 2 * * *"  // 02:00 diariamente
    },
    {
      "path": "/api/cron/data-cleanup", 
      "schedule": "0 3 * * *"  // 03:00 diariamente
    },
    {
      "path": "/api/cron/export-cleanup",
      "schedule": "0 4 * * *"  // 04:00 diariamente
    },
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 5 * * *"  // 05:00 diariamente
    },
    {
      "path": "/api/cron/google-sync",
      "schedule": "0 6 * * *"  // 06:00 diariamente
    }
  ]
}
```

### Cron Jobs Removidos (Hobby)
- `sync-scheduler` (*/5 * * * *)
- `sync-executor` (* * * * *)
- Outros crons de alta frequência

## 🚀 Alternativas para Funcionalidade Completa

### 1. Upgrade para Vercel Pro
- **Custo**: $20/mês
- **Benefício**: Cron jobs ilimitados
- **Arquivo**: `vercel-pro.json` (já criado)

### 2. Implementar Sync Manual
```typescript
// Trigger manual via API
POST /api/meta/sync
POST /api/google/sync
```

### 3. Usar Webhooks
- Meta Ads: Webhooks em tempo real
- Google Ads: Polling manual via interface

### 4. Serviços Externos
- **GitHub Actions**: Cron jobs gratuitos
- **Uptime Robot**: Monitoramento com calls
- **Cron-job.org**: Serviço gratuito

## 📋 Cronograma de Execução (Hobby)

| Horário | Cron Job | Função |
|---------|----------|---------|
| 02:00 | billing | Processamento de cobranças |
| 03:00 | data-cleanup | Limpeza de dados antigos |
| 04:00 | export-cleanup | Limpeza de exports |
| 05:00 | cleanup | Limpeza geral |
| 06:00 | google-sync | Sincronização Google Ads |

## 🔄 Como Alternar Entre Configurações

### Para Hobby (Atual)
```bash
# Já está configurado
git push
```

### Para Pro (Quando upgradar)
```bash
cp vercel-pro.json vercel.json
git add vercel.json
git commit -m "feat: Enable Pro cron jobs"
git push
```

## 🛠️ Funcionalidades Afetadas

### ✅ Funcionam Normalmente
- Dashboard principal
- Autenticação
- CRUD de usuários/organizações
- APIs manuais
- Integrações via interface

### ⚠️ Limitadas (Hobby)
- Sync automático (apenas 1x/dia)
- Monitoramento em tempo real
- Alertas automáticos
- Limpeza frequente

### 🚀 Completas (Pro)
- Sync a cada 5-10 minutos
- Monitoramento contínuo
- Alertas em tempo real
- Limpeza automática

## 💡 Recomendações

### Imediato (Hobby)
1. **Deploy funcionará** sem erros
2. **Funcionalidade básica** mantida
3. **Sync manual** via interface

### Futuro (Pro)
1. **Upgrade recomendado** para produção
2. **Funcionalidade completa** desbloqueada
3. **Monitoramento avançado** ativo

---

**✅ DEPLOY AGORA FUNCIONARÁ NO VERCEL HOBBY!**

O sistema está configurado para funcionar perfeitamente no plano gratuito, com a opção de upgrade futuro para funcionalidade completa.