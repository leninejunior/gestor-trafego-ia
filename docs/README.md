# Documentação do Sistema de Controle de Acesso

## Visão Geral

Esta documentação abrange o Sistema de Controle de Acesso Hierárquico implementado na plataforma Ads Manager. O sistema oferece três níveis distintos de usuários com permissões específicas e isolamento completo de dados entre organizações.

## 📚 Documentação Disponível

### Guias de Usuário
- **[Guia do Admin de Organização](./guides/organization-admin-guide.md)** - Manual completo para administradores de organização
- **[Processo de Criação de Super Admin](./guides/super-admin-setup.md)** - Guia seguro para criação e gerenciamento de Super Admins

### Documentação Técnica
- **[APIs do Sistema](./api/user-access-apis.md)** - Documentação completa das APIs disponíveis
- **[Troubleshooting](./troubleshooting/user-access-troubleshooting.md)** - Guia de resolução de problemas comuns

### Documentação do Sistema
- **[Visão Geral do Sistema](./USER_ACCESS_CONTROL_SYSTEM.md)** - Arquitetura e componentes principais

## 🎯 Público-Alvo

### Para Administradores de Organização
- Como gerenciar usuários da sua organização
- Como conceder e revogar acessos a clientes
- Como trabalhar dentro dos limites do seu plano

### Para Desenvolvedores
- APIs disponíveis e como utilizá-las
- Middleware de controle de acesso
- Integração com componentes React

### Para Super Admins
- Como gerenciar múltiplas organizações
- Processo seguro de criação de novos Super Admins
- Monitoramento e auditoria do sistema

### Para Suporte Técnico
- Diagnóstico de problemas comuns
- Scripts de manutenção disponíveis
- Procedimentos de emergência

## 🚀 Início Rápido

### Para Administradores de Organização

1. **Acesse o dashboard** com suas credenciais
2. **Consulte o [Guia do Admin](./guides/organization-admin-guide.md)** para instruções detalhadas
3. **Gerencie usuários** através do painel de administração
4. **Configure acessos** aos clientes conforme necessário

### Para Desenvolvedores

1. **Consulte a [Documentação de APIs](./api/user-access-apis.md)** para endpoints disponíveis
2. **Implemente middleware** de controle de acesso em suas rotas
3. **Use os hooks React** fornecidos para componentes
4. **Teste com scripts** de diagnóstico disponíveis

### Para Problemas Técnicos

1. **Consulte o [Troubleshooting](./troubleshooting/user-access-troubleshooting.md)** primeiro
2. **Execute scripts de diagnóstico** relevantes
3. **Colete logs** e informações do erro
4. **Entre em contato** com suporte se necessário

## 🏗️ Arquitetura do Sistema

### Hierarquia de Usuários

```
Super Admin (Acesso Total)
    ├── Gerencia todas as organizações
    ├── Bypass de limites de plano
    ├── Criação cross-org de usuários
    └── Acesso a logs de auditoria

Organization Admin (Gerencia Organização)
    ├── CRUD de usuários da própria org
    ├── Atribuição de acesso a clientes
    ├── Criação de clientes e conexões
    └── Limitado pelo plano contratado

Common User (Acesso Restrito)
    ├── Acesso apenas a clientes autorizados
    ├── Visualização de campanhas e relatórios
    ├── Sem permissão para criar recursos
    └── Interface simplificada
```

### Componentes Principais

1. **UserAccessControlService** - Serviço central de controle de acesso
2. **UserManagementService** - Gerenciamento CRUD de usuários
3. **Access Control Middleware** - Middleware para APIs
4. **React Hooks** - Hooks para componentes React
5. **Database Schema** - Tabelas e RLS policies

## 🔒 Segurança

### Row Level Security (RLS)
- Isolamento completo de dados entre organizações
- Políticas específicas para cada tipo de usuário
- Validação automática de permissões

### Auditoria
- Log de todas as operações sensíveis
- Rastreamento de mudanças de permissão
- Monitoramento de tentativas de acesso negado

### Cache Seguro
- TTL apropriado para diferentes tipos de dados
- Invalidação automática em mudanças
- Isolamento por usuário/organização

## 📊 Monitoramento

### Métricas Importantes
- Taxa de acesso negado por tipo de usuário
- Latência de verificação de permissões
- Uso de limites de plano por organização
- Tentativas de acesso não autorizado

### Scripts de Diagnóstico
```bash
# Verificação geral do sistema
node scripts/system-health-check.js

# Diagnóstico de usuário específico
node scripts/diagnose-user-access.js usuario@exemplo.com

# Verificação de Super Admin
node scripts/diagnose-super-admin.js admin@exemplo.com

# Status do cache
node scripts/cache-diagnostics.js
```

## 🛠️ Manutenção

### Scripts Disponíveis

#### Diagnóstico
- `system-health-check.js` - Verificação geral do sistema
- `diagnose-user-access.js` - Diagnóstico de usuário específico
- `diagnose-organization.js` - Verificação de organização
- `cache-diagnostics.js` - Status do sistema de cache

#### Manutenção
- `clear-user-access-cache.js` - Limpar cache de usuário
- `invalidate-plan-limits-cache.js` - Invalidar cache de limites
- `backup-super-admin-config.js` - Backup de configurações

#### Auditoria
- `super-admin-activity-report.js` - Relatório de atividades
- `check-plan-limits.js` - Verificar limites de plano
- `list-all-super-admins.js` - Listar Super Admins ativos

### Procedimentos de Emergência

1. **Usuário Super Admin comprometido**:
   ```sql
   UPDATE super_admins SET is_active = false WHERE user_id = 'USER_ID';
   ```

2. **Cache corrompido**:
   ```bash
   node scripts/clear-all-cache.js
   ```

3. **RLS policies com problema**:
   ```bash
   node scripts/check-rls-policies.js
   node scripts/fix-rls-policies.js
   ```

## 📞 Suporte

### Canais de Suporte

#### Suporte Técnico
- **Email**: tech-support@empresa.com
- **Slack**: #user-access-support
- **Horário**: Segunda a Sexta, 9h às 18h

#### Suporte de Emergência
- **Email**: emergency@empresa.com
- **Telefone**: +55 11 9999-9999
- **Disponível**: 24/7

#### Suporte Comercial
- **Email**: vendas@empresa.com
- **Telefone**: (11) 1234-5678
- **Upgrades de Plano**: Disponível online 24/7

### Como Obter Ajuda

1. **Consulte a documentação** relevante primeiro
2. **Execute scripts de diagnóstico** para coletar informações
3. **Prepare informações detalhadas**:
   - Descrição do problema
   - Usuário/organização afetados
   - Mensagens de erro exatas
   - Resultado dos diagnósticos
4. **Entre em contato** pelo canal apropriado

### Template de Solicitação de Suporte

```markdown
## Solicitação de Suporte - Sistema de Acesso

**Severidade**: Alta/Média/Baixa
**Tipo**: Bug/Dúvida/Solicitação de Feature
**Usuário**: usuario@exemplo.com
**Organização**: Nome da Organização

### Descrição do Problema
[Descreva detalhadamente o problema]

### Passos para Reproduzir
1. [Passo 1]
2. [Passo 2]
3. [Resultado esperado vs obtido]

### Informações Técnicas
- **Navegador**: Chrome/Firefox/Safari
- **Dispositivo**: Desktop/Mobile
- **Horário do Problema**: [Data e hora]

### Diagnóstico Executado
```bash
[Cole resultado dos scripts de diagnóstico]
```

### Logs de Erro
```
[Cole mensagens de erro relevantes]
```
```

## 🔄 Atualizações e Changelog

### Versão Atual: 1.0.0

#### Funcionalidades Implementadas
- ✅ Sistema de três níveis de usuário
- ✅ CRUD completo de usuários
- ✅ Controle granular de acesso a clientes
- ✅ Validação de limites de plano
- ✅ Middleware centralizado de APIs
- ✅ Interface React com hooks customizados
- ✅ Sistema de cache com invalidação
- ✅ Logs de auditoria completos
- ✅ Scripts de diagnóstico e manutenção

#### Próximas Funcionalidades
- 🔄 Permissões granulares por tipo de campanha
- 🔄 Self-service para solicitação de acessos
- 🔄 API Keys para integrações externas
- 🔄 Relatórios avançados de auditoria

### Como Acompanhar Atualizações

1. **Monitore o CHANGELOG.md** do projeto
2. **Assine notificações** do repositório
3. **Participe das reuniões** de review técnico
4. **Teste features** em ambiente de staging

## 📝 Contribuindo

### Para Desenvolvedores

1. **Leia a documentação** completa antes de contribuir
2. **Siga os padrões** de código estabelecidos
3. **Teste thoroughly** suas mudanças
4. **Atualize a documentação** conforme necessário
5. **Execute scripts de diagnóstico** antes do commit

### Para Documentação

1. **Mantenha consistência** com o estilo existente
2. **Inclua exemplos práticos** sempre que possível
3. **Teste procedimentos** descritos na documentação
4. **Atualize índices** e links quando necessário

---

**Última atualização**: Dezembro 2024  
**Versão da Documentação**: 1.0.0  
**Mantenedores**: Equipe de Desenvolvimento