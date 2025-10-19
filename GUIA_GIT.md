# 📚 Guia Git - Comandos Úteis

## 🚀 Comandos Básicos

### Verificar Status
```bash
git status
```
Mostra arquivos modificados, adicionados ou deletados.

### Adicionar Arquivos
```bash
# Adicionar arquivo específico
git add arquivo.txt

# Adicionar todos os arquivos
git add .

# Adicionar arquivos por padrão
git add src/**/*.tsx
```

### Commit
```bash
# Commit com mensagem
git commit -m "feat: adiciona landing page e sistema de leads"

# Commit com descrição detalhada
git commit -m "feat: adiciona landing page" -m "- Formulário de contato
- Painel admin de leads
- Scrollbar estilizada
- Sidebar colapsável"

# Adicionar e commitar em um comando
git add . && git commit -m "fix: corrige scroll duplo"
```

### Push
```bash
# Push para branch atual
git push

# Push primeira vez (criar branch remota)
git push -u origin nome-da-branch

# Forçar push (cuidado!)
git push --force
```

## 🌿 Branches

### Criar e Trocar
```bash
# Criar nova branch
git branch feature/landing-page

# Trocar de branch
git checkout feature/landing-page

# Criar e trocar em um comando
git checkout -b feature/landing-page
```

### Listar Branches
```bash
# Branches locais
git branch

# Branches remotas
git branch -r

# Todas as branches
git branch -a
```

### Deletar Branch
```bash
# Deletar branch local
git branch -d feature/landing-page

# Forçar deleção
git branch -D feature/landing-page

# Deletar branch remota
git push origin --delete feature/landing-page
```

## 🔄 Sincronização

### Pull
```bash
# Baixar e mesclar mudanças
git pull

# Pull de branch específica
git pull origin main
```

### Fetch
```bash
# Baixar mudanças sem mesclar
git fetch

# Fetch de todas as branches
git fetch --all
```

## 📝 Histórico

### Ver Commits
```bash
# Histórico completo
git log

# Histórico resumido
git log --oneline

# Últimos 5 commits
git log -5

# Com gráfico
git log --graph --oneline --all
```

### Ver Mudanças
```bash
# Mudanças não commitadas
git diff

# Mudanças em arquivo específico
git diff arquivo.txt

# Mudanças entre commits
git diff commit1 commit2
```

## ⏪ Desfazer Mudanças

### Descartar Mudanças
```bash
# Descartar mudanças em arquivo
git checkout -- arquivo.txt

# Descartar todas as mudanças
git checkout -- .

# Remover arquivo do staging
git reset HEAD arquivo.txt
```

### Reverter Commit
```bash
# Reverter último commit (mantém mudanças)
git reset --soft HEAD~1

# Reverter último commit (descarta mudanças)
git reset --hard HEAD~1

# Reverter commit específico
git revert commit-hash
```

## 🏷️ Tags

### Criar Tag
```bash
# Tag simples
git tag v1.0.0

# Tag anotada
git tag -a v1.0.0 -m "Versão 1.0.0 - Landing Page"

# Push de tags
git push --tags
```

### Listar Tags
```bash
git tag
```

## 🔍 Busca

### Buscar em Commits
```bash
# Buscar por mensagem
git log --grep="landing page"

# Buscar por autor
git log --author="Nome"

# Buscar por data
git log --since="2024-01-01"
```

### Buscar em Código
```bash
# Buscar texto em arquivos
git grep "função"

# Buscar em branch específica
git grep "função" branch-name
```

## 🛠️ Configuração

### Configurar Usuário
```bash
# Global
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"

# Por projeto
git config user.name "Seu Nome"
git config user.email "seu@email.com"
```

### Ver Configurações
```bash
# Todas as configurações
git config --list

# Configuração específica
git config user.name
```

## 📦 Stash (Guardar Mudanças)

### Salvar Mudanças
```bash
# Guardar mudanças
git stash

# Guardar com mensagem
git stash save "WIP: trabalhando em feature"

# Incluir arquivos não rastreados
git stash -u
```

### Recuperar Mudanças
```bash
# Aplicar último stash
git stash pop

# Aplicar stash específico
git stash apply stash@{0}

# Listar stashes
git stash list

# Deletar stash
git stash drop stash@{0}
```

## 🔀 Merge e Rebase

### Merge
```bash
# Mesclar branch na atual
git merge feature/landing-page

# Merge sem fast-forward
git merge --no-ff feature/landing-page
```

### Rebase
```bash
# Rebase na main
git rebase main

# Rebase interativo
git rebase -i HEAD~3
```

## 🎯 Comandos Específicos do Projeto

### Commit de Features
```bash
# Landing page
git add . && git commit -m "feat: adiciona landing page com formulário de contato"

# Sistema de leads
git add . && git commit -m "feat: implementa painel admin de gestão de leads"

# UI/UX
git add . && git commit -m "style: estiliza scrollbar e adiciona sidebar colapsável"

# Correções
git add . && git commit -m "fix: remove scroll duplo e horizontal da sidebar"
```

### Padrão de Mensagens (Conventional Commits)
```bash
feat:     # Nova funcionalidade
fix:      # Correção de bug
docs:     # Documentação
style:    # Formatação, estilo
refactor: # Refatoração de código
test:     # Testes
chore:    # Tarefas de manutenção
```

## 🚨 Situações Comuns

### Conflitos de Merge
```bash
# 1. Ver arquivos em conflito
git status

# 2. Editar arquivos e resolver conflitos

# 3. Adicionar arquivos resolvidos
git add arquivo-resolvido.txt

# 4. Continuar merge
git commit
```

### Commit Errado
```bash
# Alterar mensagem do último commit
git commit --amend -m "Nova mensagem"

# Adicionar arquivo esquecido ao último commit
git add arquivo-esquecido.txt
git commit --amend --no-edit
```

### Arquivo Grande Commitado
```bash
# Remover do histórico (cuidado!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch caminho/arquivo-grande" \
  --prune-empty --tag-name-filter cat -- --all
```

## 📊 Estatísticas

### Ver Contribuições
```bash
# Commits por autor
git shortlog -sn

# Estatísticas detalhadas
git log --stat

# Linhas adicionadas/removidas
git log --shortstat
```

## 🔐 .gitignore

### Arquivo .gitignore Comum
```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Next.js
.next/
out/
build/

# Environment
.env
.env.local
.env.production

# Debug
npm-debug.log*
yarn-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
```

## 🎓 Dicas

### Aliases Úteis
```bash
# Adicionar aliases
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.unstage 'reset HEAD --'
git config --global alias.last 'log -1 HEAD'

# Usar aliases
git st
git co main
git ci -m "mensagem"
```

### Workflow Recomendado
```bash
# 1. Atualizar main
git checkout main
git pull

# 2. Criar feature branch
git checkout -b feature/nova-funcionalidade

# 3. Trabalhar e commitar
git add .
git commit -m "feat: adiciona nova funcionalidade"

# 4. Push da branch
git push -u origin feature/nova-funcionalidade

# 5. Criar Pull Request no GitHub/GitLab

# 6. Após merge, limpar
git checkout main
git pull
git branch -d feature/nova-funcionalidade
```

## 📚 Recursos

- [Git Documentation](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)

---

**Guia criado para facilitar o uso do Git no projeto! 🚀**
