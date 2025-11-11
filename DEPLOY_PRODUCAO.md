# 🚀 Deploy para Produção - Vercel

## ✅ Código Enviado para GitHub

Commit: `feat: adiciona gerenciamento de orçamento para campanhas e adsets Meta Ads`

### Arquivos Adicionados:
- ✅ APIs de gerenciamento de orçamento (campanhas e adsets)
- ✅ APIs de controle de status (ativar/pausar)
- ✅ Componentes de interface (modal de edição, lista de adsets)
- ✅ Documentação completa

## 🔄 Deploy Automático na Vercel

A Vercel vai detectar automaticamente o push e iniciar o deploy.

### Acompanhar Deploy:

1. **Acesse o Dashboard da Vercel**: https://vercel.com/dashboard
2. **Selecione seu projeto**: flying-fox-bob (ou nome do projeto)
3. **Veja o status do deploy** na aba "Deployments"

## ⚙️ Variáveis de Ambiente (Verificar)

Certifique-se de que estas variáveis estão configuradas na Vercel:

### Meta Ads
```
META_APP_ID=seu_app_id
META_APP_SECRET=seu_app_secret
NEXT_PUBLIC_APP_URL=https://seu-dominio.vercel.app
```

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=sua_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_key
```

## 🧪 Testar em Produção

Após o deploy ser concluído:

### 1. Verificar APIs
```bash
# Testar se as novas APIs estão acessíveis
curl https://seu-dominio.vercel.app/api/campaigns/test/budget
curl https://seu-dominio.vercel.app/api/adsets/test/budget
```

### 2. Testar Interface
1. Acesse: https://seu-dominio.vercel.app
2. Faça login
3. Vá em Clientes
4. Selecione um cliente com Meta Ads conectado
5. Verifique se aparecem os novos botões:
   - ▶️ Ativar/Pausar
   - 💰 Orçamento
   - ▼ Expandir AdSets

### 3. Testar Funcionalidades

**Campanhas:**
- [ ] Ativar/Pausar campanha
- [ ] Editar orçamento diário
- [ ] Editar orçamento total
- [ ] Expandir para ver adsets

**AdSets:**
- [ ] Visualizar lista de adsets
- [ ] Ativar/Pausar adset
- [ ] Editar orçamento de adset

## 🐛 Troubleshooting

### Se o deploy falhar:

1. **Verificar logs na Vercel**
   - Vá em Deployments > [seu deploy] > Build Logs

2. **Erros comuns:**
   - Falta de variáveis de ambiente
   - Erro de build do TypeScript
   - Problema com dependências

3. **Solução rápida:**
   ```bash
   # Testar build localmente
   pnpm build
   
   # Se der erro, corrigir e fazer novo commit
   git add .
   git commit -m "fix: corrige erro de build"
   git push origin main
   ```

### Se as APIs não funcionarem:

1. **Verificar logs em tempo real:**
   - Vercel Dashboard > Functions > Ver logs

2. **Testar conexão com Supabase:**
   - Verificar se as credenciais estão corretas
   - Testar query direto no Supabase

3. **Verificar permissões Meta:**
   - Token de acesso válido
   - Permissões `ads_management`

## 📊 Monitoramento

### Logs da Vercel
- Acesse: Vercel Dashboard > seu projeto > Logs
- Filtre por: Functions, Edge, Build

### Métricas
- Tempo de resposta das APIs
- Taxa de erro
- Uso de recursos

## 🔐 Segurança

### Checklist de Segurança:
- [ ] Variáveis de ambiente configuradas
- [ ] Tokens não expostos no código
- [ ] RLS policies ativas no Supabase
- [ ] CORS configurado corretamente
- [ ] Rate limiting ativo

## 📝 Rollback (Se Necessário)

Se algo der errado, você pode fazer rollback:

1. **Na Vercel:**
   - Vá em Deployments
   - Encontre o deploy anterior que funcionava
   - Clique em "..." > "Promote to Production"

2. **No Git:**
   ```bash
   # Reverter último commit
   git revert HEAD
   git push origin main
   ```

## ✅ Checklist Final

Antes de considerar o deploy completo:

- [ ] Deploy concluído com sucesso na Vercel
- [ ] Todas as variáveis de ambiente configuradas
- [ ] APIs respondendo corretamente
- [ ] Interface carregando sem erros
- [ ] Funcionalidades testadas manualmente
- [ ] Logs sem erros críticos
- [ ] Performance aceitável

## 🎉 Deploy Concluído!

Seu sistema agora tem:
- ✅ Gerenciamento completo de campanhas Meta Ads
- ✅ Controle de orçamento (campanhas e adsets)
- ✅ Ativar/Pausar campanhas e adsets
- ✅ Interface intuitiva e responsiva

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs na Vercel
2. Teste localmente primeiro
3. Consulte a documentação em `GERENCIAMENTO_CAMPANHAS_ORCAMENTO.md`

---

**Última atualização:** 11/11/2025
**Versão:** 1.0.0
**Status:** ✅ Pronto para produção
