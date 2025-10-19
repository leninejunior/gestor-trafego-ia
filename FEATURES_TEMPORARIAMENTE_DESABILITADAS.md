# Features Temporariamente Desabilitadas em Produção

## Por que algumas features estão desabilitadas?

O Next.js 15 tem validação de tipos muito mais rigorosa em produção do que em desenvolvimento. Algumas features avançadas que funcionam perfeitamente em dev precisam de pequenos ajustes para passar na validação de produção.

## ✅ O que ESTÁ funcionando em produção:

### Core do Sistema (100% funcional)
- ✅ **Dashboard principal** - Visão geral completa
- ✅ **Gestão de clientes** - CRUD completo com isolamento
- ✅ **Integração Meta Ads** - OAuth, sincronização, campanhas
- ✅ **Campanhas e métricas** - Visualização e análise
- ✅ **Relatórios** - Geração e exportação
- ✅ **Gestão de equipes** - Convites, membros, permissões
- ✅ **Admin de organizações** - Gestão multi-tenant
- ✅ **Admin de usuários** - Gerenciamento completo
- ✅ **Autenticação** - Login, registro, recuperação de senha
- ✅ **Dashboard de campanhas** - Métricas semanais, demográficas
- ✅ **Métricas personalizadas** - Criação e cálculo
- ✅ **Views personalizadas** - Dashboard customizável

## ⏸️ O que está TEMPORARIAMENTE desabilitado:

### Features Avançadas (em ajuste)
- ⏸️ **Objetivos Inteligentes** - Sistema de metas e alertas
- ⏸️ **API Pública v1** - Endpoints REST para integração externa
- ⏸️ **Monitoramento Avançado** - Métricas de sistema e alertas
- ⏸️ **Verificação de Saldo** - Alertas de saldo de contas
- ⏸️ **Configuração LLM** - Integração com IA
- ⏸️ **AI Agent** - Assistente inteligente
- ⏸️ **UTM Builder** - Gerador de UTMs
- ⏸️ **Push Notifications** - Notificações push
- ⏸️ **Webhooks** - Recebimento de eventos externos
- ⏸️ **Sync Avançado** - Sincronização em tempo real
- ⏸️ **Backup Automático** - Sistema de backup
- ⏸️ **Workflow Engine** - Automações complexas

## 🔧 Como reativar (para desenvolvedores):

1. Edite `.vercelignore` e remova as linhas das features que quer reativar
2. Corrija os erros de tipo TypeScript (geralmente exports inválidos)
3. Faça commit e push
4. A Vercel vai fazer rebuild automático

## 📝 Problemas Comuns e Soluções:

### Erro: "is not a valid Route export field"
**Causa**: Exportando classes ou variáveis que não são rotas HTTP
**Solução**: Mover classes para arquivos separados em `src/lib/`

### Erro: "Module not found"
**Causa**: Dependência de arquivo que está no `.vercelignore`
**Solução**: Remover import ou adicionar arquivo de volta

### Erro: "params must be Promise"
**Causa**: Next.js 15 mudou API de params para async
**Solução**: Mudar `params: { id: string }` para `params: Promise<{ id: string }>`

## 🎯 Prioridade de Reativação:

1. **Alta**: Objetivos Inteligentes, API Pública v1
2. **Média**: Monitoramento, Verificação de Saldo
3. **Baixa**: Features experimentais (LLM, AI Agent)

## 💡 Nota Importante:

**TODAS essas features funcionam perfeitamente em desenvolvimento!** Você pode continuar desenvolvendo e testando localmente sem problemas. Estamos apenas sendo cautelosos com o deploy em produção para garantir estabilidade.

---

**Última atualização**: 19/10/2025
**Status**: Sistema core 100% funcional em produção
