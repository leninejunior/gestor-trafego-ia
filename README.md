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

## Docker Local (web + postgres)

```bash
# Subir app web + banco postgres
docker compose up --build -d

# Ver logs do web
docker compose logs -f web

# Derrubar ambiente
docker compose down
```

Serviços:
- `web`: Next.js em `http://localhost:3000`
- `postgres`: PostgreSQL em `localhost:5432`

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

### Sistema de Controle de Acesso (02 de Janeiro de 2026)
- ✅ Sistema completo de controle de acesso implementado
- ✅ 3 tipos de usuário: Master, Regular e Cliente
- ✅ Limites baseados em planos de assinatura
- ✅ Isolamento total de dados por cliente
- 📚 [Documentação Completa](./SISTEMA_CONTROLE_ACESSO_INDEX.md)

**Tipos de Usuário:**
- **Master:** Acesso ilimitado, sem vinculação a planos
- **Regular:** Limitado por plano de assinatura ativo
- **Cliente:** Acesso restrito e read-only aos próprios dados

**Documentação:**
- 📖 [Resumo Executivo](./SISTEMA_CONTROLE_ACESSO_RESUMO_EXECUTIVO.md)
- 🚀 [Guia Rápido](./SISTEMA_CONTROLE_ACESSO_GUIA_RAPIDO.md)
- 🔄 [Fluxo Visual](./SISTEMA_CONTROLE_ACESSO_FLUXO.md)

### Google Ads API v22 (19 de Novembro de 2025)
- ✅ Migração concluída de v18 para v22
- ✅ v18 foi descontinuada em 20 de agosto de 2025
- 📖 [Documentação de Migração](./docs/GOOGLE_ADS_V22_MIGRATION.md)
- 🧪 [Guia de Validação](./docs/GOOGLE_ADS_V22_VALIDATION.md)

Para validar a migração:
```bash
node scripts/test-google-ads-v22.js
```
