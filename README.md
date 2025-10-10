# 🚀 SaaS de Marketing Digital - Sistema Completo

## 📋 Visão Geral

Sistema SaaS completo para gerenciamento de campanhas de marketing digital com foco em Meta Ads e Google Ads. Inclui analytics avançado com IA, sistema de onboarding estruturado e painel administrativo profissional.

## ✨ Funcionalidades Principais

### 🎯 **Sistema de Onboarding**
- Wizard interativo de 5 etapas
- Checklist inteligente de progresso
- Tutorial com overlay interativo
- Configuração guiada para novos usuários

### 📊 **Analytics Avançado com IA**
- 8 KPIs principais com comparação temporal
- Análise de performance por campanha
- ROI analysis com múltiplas visualizações
- Insights de audiência segmentados
- Análise competitiva com benchmarks
- Analytics preditivo com machine learning

### 👑 **Painel Administrativo**
- Dashboard com métricas globais do sistema
- Gerenciamento completo de organizações
- Controle financeiro e de assinaturas
- Gestão de usuários e permissões

### 🏢 **Sistema Multi-tenant**
- Organizações com membros e roles
- Sistema de convites por email
- Planos e assinaturas flexíveis
- RLS (Row Level Security) implementado

### 🔗 **Integrações**
- Meta Ads API (Facebook/Instagram)
- Google Ads API (preparado)
- WhatsApp Business (preparado)
- Stripe para pagamentos

## 🛠️ Tecnologias Utilizadas

### **Frontend**
- **Next.js 15** - Framework React com App Router
- **React 19** - Biblioteca de interface
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Framework de CSS
- **Radix UI** - Componentes acessíveis
- **Lucide React** - Ícones

### **Backend**
- **Supabase** - Backend as a Service
- **PostgreSQL** - Banco de dados
- **Row Level Security** - Segurança de dados
- **Edge Functions** - Funções serverless

### **Integrações**
- **Meta Ads API** - Campanhas Facebook/Instagram
- **Stripe** - Processamento de pagamentos
- **Resend** - Envio de emails

## 📁 Estrutura do Projeto

```
├── src/
│   ├── app/                          # App Router (Next.js 15)
│   │   ├── dashboard/               # Dashboard principal
│   │   │   ├── analytics/          # Analytics básico
│   │   │   │   └── advanced/       # Analytics avançado com IA
│   │   │   ├── clients/            # Gerenciamento de clientes
│   │   │   ├── meta/               # Integração Meta Ads
│   │   │   ├── reports/            # Relatórios
│   │   │   └── team/               # Gestão de equipe
│   │   ├── onboarding/             # Sistema de onboarding
│   │   │   └── wizard/             # Wizard interativo
│   │   ├── admin/                  # Painel administrativo
│   │   │   ├── organizations/      # Gestão de organizações
│   │   │   ├── users/              # Gestão de usuários
│   │   │   └── billing/            # Controle financeiro
│   │   └── api/                    # API Routes
│   ├── components/                 # Componentes React
│   │   ├── analytics/              # Componentes de analytics
│   │   ├── onboarding/             # Componentes de onboarding
│   │   ├── dashboard/              # Componentes do dashboard
│   │   └── ui/                     # Componentes base (Radix UI)
│   └── lib/                        # Utilitários e configurações
├── database/                       # Scripts SQL
├── docs/                          # Documentação
└── scripts/                      # Scripts de automação
```

## 🚀 Instalação e Configuração

### **1. Pré-requisitos**
- Node.js 18+ 
- npm ou yarn
- Conta no Supabase
- Conta no Meta for Developers (opcional)

### **2. Clonagem e Instalação**
```bash
git clone <repository-url>
cd saas-marketing-digital
npm install
```

### **3. Configuração do Ambiente**
Copie o arquivo `.env.example` para `.env` e configure:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Meta Ads API
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_ACCESS_TOKEN=your_meta_access_token

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### **4. Configuração do Banco de Dados**
Execute os scripts SQL na seguinte ordem:

```bash
# 1. Schema principal
psql -f database/complete-saas-setup.sql

# 2. Funções administrativas
psql -f database/admin-functions.sql

# 3. Schema Meta Ads
psql -f database/meta-ads-schema.sql
```

### **5. Executar o Projeto**
```bash
npm run dev
```

Acesse: `http://localhost:3000`

## 📊 Funcionalidades Detalhadas

### **Analytics Avançado** (`/dashboard/analytics/advanced`)

#### **KPIs Principais**
- **Investimento Total**: Gasto em anúncios com variação temporal
- **ROAS**: Retorno sobre investimento com classificação
- **Impressões**: Alcance total das campanhas
- **Cliques**: Interações com os anúncios
- **CTR**: Taxa de cliques com benchmark
- **CPC**: Custo por clique otimizado
- **Conversões**: Ações desejadas completadas
- **Taxa de Conversão**: Eficiência de conversão

#### **6 Seções Especializadas**

1. **Performance**
   - Ranking de campanhas por métrica
   - Gráficos de barras horizontais
   - Comparação entre períodos
   - Resumo estatístico

2. **ROI**
   - Breakdown financeiro completo
   - ROI por canal de anúncios
   - Calculadora de cenários
   - Projeções inteligentes

3. **Audiência**
   - Demografia (idade, gênero)
   - Geografia (cidades, estados)
   - Dispositivos (mobile, desktop)
   - Horários de atividade
   - Interesses e comportamento

4. **Concorrentes**
   - Benchmarking automático
   - Perfil de 3 principais concorrentes
   - Análise de pontos fortes/fracos
   - Vantagens competitivas

5. **Preditivo**
   - 3 modelos de projeção (conservador, moderado, agressivo)
   - Confiança estatística
   - Cenários de investimento
   - Insights de IA

6. **Insights**
   - Descobertas automáticas
   - Recomendações acionáveis
   - Alertas inteligentes
   - Próximos passos sugeridos

### **Sistema de Onboarding**

#### **Página Principal** (`/onboarding`)
- Progresso visual com barra de progresso
- 5 etapas principais trackadas
- Quick actions contextuais
- Recursos de aprendizado

#### **Wizard Interativo** (`/onboarding/wizard`)
- **Etapa 1**: Boas-vindas e introdução
- **Etapa 2**: Configuração da organização
- **Etapa 3**: Primeiro cliente
- **Etapa 4**: Objetivos e metas
- **Etapa 5**: Finalização e próximos passos

#### **Checklist Inteligente**
- Progresso em tempo real
- Priorização por importância
- Ações diretas para cada item
- Modo compacto para dashboard

### **Painel Administrativo** (`/admin`)

#### **Dashboard Principal**
- Métricas globais do sistema
- Organizações, usuários, receita
- Atividade recente
- Alertas do sistema

#### **Gestão de Organizações** (`/admin/organizations`)
- Lista completa com estatísticas
- Detalhes individuais por organização
- Controle de membros e roles
- Métricas de uso vs limites do plano

#### **Controle Financeiro** (`/admin/billing`)
- MRR (Monthly Recurring Revenue)
- ARR (Annual Recurring Revenue)
- Taxa de churn
- Status de assinaturas
- Distribuição por plano

#### **Gestão de Usuários** (`/admin/users`)
- Lista de todos os usuários
- Controle de roles e permissões
- Status de ativação
- Histórico de atividade

## 🎨 Design System

### **Paleta de Cores**
- **Primária**: Azul (#3B82F6) - Ações principais
- **Sucesso**: Verde (#10B981) - Métricas positivas
- **Aviso**: Amarelo (#F59E0B) - Alertas
- **Erro**: Vermelho (#EF4444) - Problemas
- **Neutro**: Cinza (#6B7280) - Textos e bordas

### **Componentes UI**
- **Cards**: Informações organizadas
- **Badges**: Status e classificações
- **Progress Bars**: Progresso e métricas
- **Tabs**: Organização de conteúdo
- **Buttons**: Ações e navegação

### **Responsividade**
- **Desktop**: 1920px+ (layout completo)
- **Tablet**: 768px-1919px (layout adaptado)
- **Mobile**: 375px-767px (layout compacto)

## 🔐 Segurança

### **Autenticação**
- Supabase Auth com email/senha
- Verificação de email obrigatória
- Sessões seguras com JWT

### **Autorização**
- Row Level Security (RLS) no PostgreSQL
- Roles granulares (owner, admin, member, viewer)
- Políticas de acesso por organização

### **Proteção de Dados**
- Criptografia em trânsito (HTTPS)
- Criptografia em repouso (Supabase)
- Logs de auditoria para ações críticas

## 📈 Performance

### **Otimizações Frontend**
- Next.js App Router com SSR
- Componentes lazy loading
- Imagens otimizadas
- Bundle splitting automático

### **Otimizações Backend**
- Queries otimizadas com índices
- Cache de dados frequentes
- Edge Functions para APIs
- CDN global (Supabase)

## 🧪 Testes

### **Teste Automatizado**
```bash
# Executar teste do sistema
node scripts/test-system.js
```

### **Testes Manuais**
1. **Fluxo de Onboarding**: Complete todas as etapas
2. **Analytics Avançado**: Explore todas as 6 tabs
3. **Painel Admin**: Teste controles administrativos
4. **Responsividade**: Teste em diferentes dispositivos

## 📚 Documentação Adicional

- [Sistema SaaS Completo](SISTEMA_SAAS_COMPLETO.md)
- [Painel Admin Completo](PAINEL_ADMIN_COMPLETO.md)
- [Sistema de Onboarding](SISTEMA_ONBOARDING_COMPLETO.md)
- [Dashboards Avançados](DASHBOARDS_AVANCADOS_COMPLETO.md)
- [Guia de Teste](GUIA_TESTE_SISTEMA_COMPLETO.md)

## 🚀 Deploy

### **Vercel (Recomendado)**
```bash
npm install -g vercel
vercel
```

### **Netlify**
```bash
npm run build
# Upload da pasta .next para Netlify
```

### **Docker**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contribuição

### **Estrutura de Branches**
- `main` - Produção estável
- `develop` - Desenvolvimento ativo
- `feature/*` - Novas funcionalidades
- `hotfix/*` - Correções urgentes

### **Padrão de Commits**
```
feat: adiciona nova funcionalidade
fix: corrige bug
docs: atualiza documentação
style: ajustes de formatação
refactor: refatoração de código
test: adiciona ou corrige testes
```

## 📞 Suporte

### **Documentação**
- README principal (este arquivo)
- Documentos específicos na pasta raiz
- Comentários inline no código

### **Logs e Debug**
- Console do navegador para frontend
- Supabase Dashboard para backend
- Scripts de debug em `/scripts`

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 🎉 Status do Projeto

**✅ SISTEMA COMPLETO E FUNCIONAL**

- 📊 Analytics avançado com IA
- 🎯 Onboarding estruturado
- 👑 Painel administrativo
- 🏢 Sistema multi-tenant
- 🔗 Integrações preparadas
- 🎨 Interface moderna
- 🔐 Segurança robusta
- 📱 Totalmente responsivo

**Pronto para produção!** 🚀