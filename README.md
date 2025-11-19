# Sistema de Gestão de Anúncios

Sistema SaaS para gestão de campanhas Meta Ads e Google Ads.

## Desenvolvimento

```bash
# Instalar dependências
pnpm install

# Iniciar desenvolvimento
pnpm dev

# Verificar sistema
node scripts/dev-utils.js check-user
node scripts/dev-utils.js check-orgs
node scripts/dev-utils.js check-clients

# Criar cliente de teste
node scripts/dev-utils.js create-test-client
```

## Estrutura

- `src/app` - Páginas e APIs Next.js
- `src/components` - Componentes React
- `src/lib` - Utilitários e serviços
- `database` - Schemas SQL
- `scripts` - Scripts de desenvolvimento

## Fluxo SaaS

1. Usuário se cadastra → Cria organização
2. Organização → Cria clientes
3. Clientes → Conecta contas de anúncios
4. Campanhas → Métricas e relatórios

## Tecnologias

- Next.js 15 + React 19
- Supabase (PostgreSQL + Auth)
- Tailwind CSS + shadcn/ui
- Meta Marketing API
- Google Ads API v22 ✅

## 🚀 Atualizações Recentes

### Google Ads API v22 (19 de Novembro de 2025)
- ✅ Migração concluída de v18 para v22
- ✅ v18 foi descontinuada em 20 de agosto de 2025
- 📖 [Documentação de Migração](./docs/GOOGLE_ADS_V22_MIGRATION.md)
- 🧪 [Guia de Validação](./docs/GOOGLE_ADS_V22_VALIDATION.md)

Para validar a migração:
```bash
node scripts/test-google-ads-v22.js
```