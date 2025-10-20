# Ads Manager - Sistema de Gerenciamento de Campanhas

Sistema completo para gerenciamento de campanhas Meta Ads (Facebook/Instagram) com suporte multi-cliente e isolamento de dados.

## 🚀 Stack Tecnológica

- **Framework**: Next.js 15.3.4 (App Router)
- **UI**: React 19, Tailwind CSS 3.4, shadcn/ui
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **APIs**: Meta Marketing API, Facebook Business SDK
- **Package Manager**: pnpm

## 📋 Funcionalidades Principais

### ✅ Produção (Funcionando)
- **Dashboard Principal**: Visão geral de clientes e campanhas
- **Gerenciamento de Clientes**: CRUD completo com isolamento de dados
- **Meta Ads Integration**: OAuth 2.0, sincronização de campanhas
- **Analytics**: Métricas em tempo real, relatórios personalizados
- **Painel Admin**: Gerenciamento de organizações, usuários e leads
- **Landing Page**: Captura de leads com formulário integrado
- **Autenticação**: Sistema completo com Supabase Auth

### ⏸️ Em Desenvolvimento (Bloqueadas temporariamente)
- Monitoramento de sistema
- Gestão de saldo
- Campanhas admin avançadas
- UTM tracking
- AI Agent
- LLM Config

## 🛠️ Instalação e Configuração

### Pré-requisitos
```bash
Node.js 18+
pnpm
Conta Supabase
Meta App (Facebook Developers)
```

### 1. Clone e Instale Dependências
```bash
git clone <repository-url>
cd flying-fox-bob
pnpm install
```

### 2. Configure Variáveis de Ambiente
Copie `.env.example` para `.env` e configure:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Meta API
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Configure o Banco de Dados
Execute no Supabase SQL Editor:

```bash
# Schema principal
database/complete-schema.sql

# Schema de leads (landing page)
database/landing-leads-schema.sql

# Schema SaaS (organizações e memberships)
database/complete-saas-setup.sql
```

### 4. Inicie o Servidor
```bash
pnpm dev
```

Acesse: `http://localhost:3000`

## 📁 Estrutura do Projeto

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Routes
│   │   ├── dashboard/         # Dashboard pages
│   │   ├── admin/             # Admin pages
│   │   └── login/             # Auth pages
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── dashboard/        # Dashboard components
│   │   ├── meta/             # Meta Ads components
│   │   └── landing/          # Landing page components
│   ├── lib/                  # Utilities
│   │   ├── supabase/        # Database client
│   │   └── meta/            # Meta API client
│   └── hooks/               # Custom React hooks
├── database/                 # SQL schemas
├── docs/                    # Documentation
└── scripts/                 # Utility scripts
```

## 🔐 Segurança e Isolamento de Dados

### Row Level Security (RLS)
Todas as tabelas principais implementam RLS para garantir isolamento de dados:

- **clients**: Filtrados por `org_id`
- **meta_campaigns**: Filtrados por `client_id`
- **memberships**: Controle de acesso por organização

### Roles e Permissões
- **super_admin**: Acesso total ao sistema
- **admin**: Gerenciamento da organização
- **manager**: Gerenciamento de clientes
- **viewer**: Visualização apenas

## 📊 Integração Meta Ads

### Configuração
1. Crie um app em [Facebook Developers](https://developers.facebook.com/)
2. Configure OAuth redirect: `{APP_URL}/api/meta/callback`
3. Adicione permissões: `ads_read`, `ads_management`
4. Configure as credenciais no `.env`

### Fluxo de Conexão
1. Cliente clica em "Conectar Meta Ads"
2. OAuth flow com Facebook
3. Seleção de contas de anúncios
4. Sincronização automática de campanhas

## 🚀 Deploy (Vercel)

### Configuração Automática
O projeto está configurado para deploy automático na Vercel:

```bash
git push origin main
```

### Variáveis de Ambiente
Configure no painel da Vercel:
- Todas as variáveis do `.env`
- `NEXT_PUBLIC_APP_URL` com a URL de produção

### Build
```bash
pnpm build
```

## 📝 Scripts Disponíveis

```bash
pnpm dev              # Desenvolvimento
pnpm build            # Build produção
pnpm start            # Start produção
pnpm lint             # Lint código
```

## 🐛 Troubleshooting

### Erro de Autenticação
- Verifique as credenciais do Supabase
- Confirme que o usuário tem membership ativo

### Campanhas não aparecem
- Verifique a conexão Meta Ads
- Execute sincronização manual
- Confirme permissões da conta

### Erro 404 em páginas admin
- Algumas páginas estão temporariamente bloqueadas
- Verifique `.vercelignore`

## 📚 Documentação Adicional

- [Meta Integration Guide](docs/META_INTEGRATION.md)
- [Setup Meta Ads](docs/SETUP_META_ADS.md)

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.

## 🆘 Suporte

Para suporte, entre em contato através do email ou abra uma issue no repositório.

---

**Última atualização**: Janeiro 2025
**Versão**: 1.0.0
