# 🏷️ Guia para Mudar o Nome do Site

## 📋 Locais que Precisam ser Atualizados

### 1. **package.json**
```json
{
  "name": "NOVO_NOME",  // Atualmente: "next-template"
  "version": "1.0.0",
  "description": "Sistema de gerenciamento de campanhas NOVO_NOME"
}
```

### 2. **README.md**
- Título principal
- Descrição do projeto
- Referências ao nome antigo

### 3. **.kiro/steering/product.md**
```markdown
# Product Overview

## NOVO_NOME

Descrição do sistema...
```

### 4. **Metadados Next.js** (`src/app/layout.tsx`)
```typescript
export const metadata: Metadata = {
  title: 'NOVO_NOME - Gerenciamento de Campanhas',
  description: 'Sistema completo de gerenciamento...'
}
```

### 5. **Variáveis de Ambiente** (`.env.example`)
```env
# NOVO_NOME Configuration
NEXT_PUBLIC_APP_NAME=NOVO_NOME
```

### 6. **Componentes UI**
- `src/components/dashboard/header.tsx` - Logo/título
- `src/components/dashboard/sidebar.tsx` - Nome da aplicação
- `src/components/landing/landing-page.tsx` - Branding

### 7. **Documentação**
- `docs/META_INTEGRATION.md`
- `docs/SETUP_META_ADS.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`

### 8. **Configurações de Deploy**
- `vercel.json` - Nome do projeto
- `.vercelignore` - Comentários

## 🎨 Sugestões de Nomes

### Opção 1: **FlatiConta**
- Foco em gestão de contas e saldo
- Nome único e memorável
- Relacionado ao conceito de "flat" (simples/direto)

### Opção 2: **AdFlow**
- Fluxo de anúncios
- Moderno e profissional
- Fácil de pronunciar

### Opção 3: **CampaignHub**
- Central de campanhas
- Descritivo
- Profissional

### Opção 4: **MetaFlow**
- Foco em Meta Ads
- Moderno
- Relacionado ao produto principal

### Opção 5: **AdsControl**
- Controle de anúncios
- Direto ao ponto
- Profissional

### Opção 6: **Gestor Engrene** (Mencionado em docs)
- Nome brasileiro
- Relacionado a engrenagens/sistema
- Único

## 🚀 Script de Atualização

Após decidir o nome, execute:

```bash
# 1. Atualizar package.json
npm pkg set name="novo-nome"

# 2. Atualizar todos os arquivos
# (será criado script automatizado)
node scripts/update-brand-name.js "NOVO_NOME"
```

## 📝 Checklist de Atualização

- [ ] package.json
- [ ] README.md
- [ ] .kiro/steering/product.md
- [ ] src/app/layout.tsx (metadata)
- [ ] .env.example
- [ ] Componentes de UI
- [ ] Documentação
- [ ] Configurações de deploy
- [ ] Favicon e assets
- [ ] Meta tags (SEO)

## 🎯 Próximos Passos

1. **Decidir o nome**
2. **Executar script de atualização**
3. **Atualizar logo/favicon** (se necessário)
4. **Testar localmente**
5. **Commit e deploy**

---

**Aguardando decisão do nome para prosseguir com as atualizações...**
