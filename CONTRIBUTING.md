# 🤝 Guia de Contribuição

Obrigado por considerar contribuir para o projeto SaaS de Marketing Digital! Este documento fornece diretrizes para contribuições.

## 📋 Índice

- [Como Contribuir](#como-contribuir)
- [Estrutura de Branches](#estrutura-de-branches)
- [Padrões de Código](#padrões-de-código)
- [Padrão de Commits](#padrão-de-commits)
- [Pull Requests](#pull-requests)
- [Reportar Bugs](#reportar-bugs)
- [Sugerir Funcionalidades](#sugerir-funcionalidades)

## 🚀 Como Contribuir

### 1. Fork do Repositório
```bash
git clone https://github.com/seu-usuario/saas-marketing-digital.git
cd saas-marketing-digital
```

### 2. Configurar Ambiente
```bash
npm install
cp .env.example .env
# Configure as variáveis de ambiente
npm run dev
```

### 3. Criar Branch
```bash
git checkout -b feature/nova-funcionalidade
# ou
git checkout -b fix/correcao-bug
```

### 4. Fazer Alterações
- Siga os padrões de código estabelecidos
- Adicione testes quando necessário
- Atualize a documentação

### 5. Commit e Push
```bash
git add .
git commit -m "feat: adiciona nova funcionalidade"
git push origin feature/nova-funcionalidade
```

### 6. Criar Pull Request
- Descreva claramente as alterações
- Referencie issues relacionadas
- Aguarde review e feedback

## 🌳 Estrutura de Branches

### **Branches Principais**
- `main` - Código em produção (estável)
- `develop` - Desenvolvimento ativo
- `staging` - Testes antes da produção

### **Branches de Funcionalidade**
- `feature/nome-da-funcionalidade` - Novas funcionalidades
- `fix/nome-do-bug` - Correções de bugs
- `hotfix/nome-da-correcao` - Correções urgentes
- `docs/nome-da-documentacao` - Atualizações de documentação
- `refactor/nome-da-refatoracao` - Refatorações de código

### **Convenção de Nomes**
```
feature/analytics-avancado
fix/sidebar-navigation
hotfix/security-vulnerability
docs/api-documentation
refactor/database-queries
```

## 💻 Padrões de Código

### **TypeScript**
```typescript
// ✅ Bom
interface UserProps {
  id: string;
  name: string;
  email: string;
}

const UserCard: React.FC<UserProps> = ({ id, name, email }) => {
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-medium">{name}</h3>
      <p className="text-gray-500">{email}</p>
    </div>
  );
};

// ❌ Evitar
const UserCard = (props: any) => {
  return <div>{props.name}</div>;
};
```

### **React Components**
```typescript
// ✅ Estrutura recomendada
'use client'; // Se necessário

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ComponentProps {
  // Props tipadas
}

export default function Component({ prop1, prop2 }: ComponentProps) {
  // Hooks
  const [state, setState] = useState();

  // Effects
  useEffect(() => {
    // Logic
  }, []);

  // Handlers
  const handleAction = () => {
    // Logic
  };

  // Render
  return (
    <Card>
      <CardHeader>
        <CardTitle>Título</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Conteúdo */}
      </CardContent>
    </Card>
  );
}
```

### **Styling (Tailwind CSS)**
```typescript
// ✅ Classes organizadas
<div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">

// ✅ Responsividade
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// ✅ Estados condicionais
<Button 
  className={cn(
    "px-4 py-2 rounded-md transition-colors",
    isActive ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
  )}
>
```

### **Estrutura de Arquivos**
```
src/
├── app/                    # App Router pages
│   ├── dashboard/         # Dashboard pages
│   ├── admin/            # Admin pages
│   └── api/              # API routes
├── components/           # React components
│   ├── ui/              # Base UI components
│   ├── dashboard/       # Dashboard components
│   └── analytics/       # Analytics components
├── lib/                 # Utilities and configs
├── hooks/              # Custom hooks
└── types/              # TypeScript types
```

## 📝 Padrão de Commits

### **Formato**
```
tipo(escopo): descrição

corpo (opcional)

rodapé (opcional)
```

### **Tipos**
- `feat` - Nova funcionalidade
- `fix` - Correção de bug
- `docs` - Documentação
- `style` - Formatação, ponto e vírgula, etc
- `refactor` - Refatoração de código
- `test` - Adição ou correção de testes
- `chore` - Tarefas de build, configuração, etc

### **Exemplos**
```bash
feat(analytics): adiciona gráfico de ROI por campanha
fix(sidebar): corrige navegação em mobile
docs(readme): atualiza guia de instalação
style(components): formata código com prettier
refactor(api): otimiza queries do banco de dados
test(auth): adiciona testes de autenticação
chore(deps): atualiza dependências do projeto
```

### **Escopo (opcional)**
- `analytics` - Funcionalidades de analytics
- `onboarding` - Sistema de onboarding
- `admin` - Painel administrativo
- `auth` - Autenticação
- `ui` - Componentes de interface
- `api` - APIs e backend
- `db` - Banco de dados

## 🔄 Pull Requests

### **Template de PR**
```markdown
## 📋 Descrição
Breve descrição das alterações realizadas.

## 🎯 Tipo de Mudança
- [ ] Bug fix (correção que resolve um problema)
- [ ] Nova funcionalidade (adiciona funcionalidade sem quebrar existente)
- [ ] Breaking change (mudança que quebra funcionalidade existente)
- [ ] Documentação (apenas mudanças na documentação)

## 🧪 Como Testar
1. Passo 1
2. Passo 2
3. Passo 3

## 📸 Screenshots (se aplicável)
Adicione screenshots das mudanças visuais.

## ✅ Checklist
- [ ] Código segue os padrões do projeto
- [ ] Realizei self-review do código
- [ ] Comentei código em áreas complexas
- [ ] Atualizei documentação relacionada
- [ ] Mudanças não geram novos warnings
- [ ] Adicionei testes que provam que a correção/funcionalidade funciona
- [ ] Testes novos e existentes passam
```

### **Processo de Review**
1. **Automated Checks**: Testes e linting automáticos
2. **Code Review**: Review por pelo menos 1 desenvolvedor
3. **Testing**: Testes manuais se necessário
4. **Approval**: Aprovação antes do merge
5. **Merge**: Squash and merge preferido

## 🐛 Reportar Bugs

### **Template de Bug Report**
```markdown
## 🐛 Descrição do Bug
Descrição clara e concisa do bug.

## 🔄 Passos para Reproduzir
1. Vá para '...'
2. Clique em '...'
3. Role até '...'
4. Veja o erro

## ✅ Comportamento Esperado
Descrição do que deveria acontecer.

## 📸 Screenshots
Se aplicável, adicione screenshots.

## 🖥️ Ambiente
- OS: [e.g. Windows 10, macOS 12]
- Browser: [e.g. Chrome 96, Safari 15]
- Versão: [e.g. v2.0.0]

## 📝 Contexto Adicional
Qualquer outro contexto sobre o problema.
```

## 💡 Sugerir Funcionalidades

### **Template de Feature Request**
```markdown
## 🚀 Funcionalidade Sugerida
Descrição clara da funcionalidade desejada.

## 🎯 Problema que Resolve
Descrição do problema que esta funcionalidade resolveria.

## 💡 Solução Proposta
Descrição de como você gostaria que funcionasse.

## 🔄 Alternativas Consideradas
Outras soluções que você considerou.

## 📝 Contexto Adicional
Qualquer outro contexto ou screenshots.
```

## 🧪 Testes

### **Executar Testes**
```bash
# Teste automatizado do sistema
node scripts/test-system.js

# Testes unitários (quando implementados)
npm test

# Linting
npm run lint

# Type checking
npm run type-check
```

### **Testes Manuais**
1. **Funcionalidade**: Teste a funcionalidade específica
2. **Regressão**: Teste funcionalidades relacionadas
3. **Responsividade**: Teste em diferentes dispositivos
4. **Performance**: Verifique impacto na performance

## 📚 Documentação

### **Atualizando Documentação**
- README.md para mudanças gerais
- Documentos específicos para funcionalidades
- Comentários inline para código complexo
- CHANGELOG.md para todas as mudanças

### **Padrão de Documentação**
```markdown
# 📋 Título da Seção

## 🎯 Objetivo
Descrição do objetivo da funcionalidade.

## 🚀 Como Usar
Instruções passo a passo.

## 📊 Exemplos
Exemplos práticos de uso.

## ⚠️ Considerações
Pontos importantes a considerar.
```

## 🤝 Código de Conduta

### **Nossos Padrões**
- Usar linguagem acolhedora e inclusiva
- Respeitar diferentes pontos de vista
- Aceitar críticas construtivas
- Focar no que é melhor para a comunidade
- Mostrar empatia com outros membros

### **Comportamentos Inaceitáveis**
- Linguagem ou imagens sexualizadas
- Trolling, comentários insultuosos
- Assédio público ou privado
- Publicar informações privadas de outros
- Outras condutas inadequadas

## 📞 Contato

### **Dúvidas sobre Contribuição**
- Abra uma issue com a tag `question`
- Consulte a documentação existente
- Verifique issues e PRs anteriores

### **Suporte Técnico**
- Issues para bugs e problemas
- Discussions para perguntas gerais
- Wiki para documentação adicional

---

## 🎉 Obrigado por Contribuir!

Sua contribuição é valiosa para o crescimento e melhoria do projeto. Juntos, estamos construindo uma ferramenta incrível para profissionais de marketing digital!

**Happy Coding!** 🚀