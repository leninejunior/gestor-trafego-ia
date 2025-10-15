# 🚀 Como Usar os Scripts - Guia Rápido

## ⚡ **COMANDOS MAIS USADOS**

### **Para Iniciar o Servidor (Mais Simples):**
```bash
npm run start-dev
```
**O que faz:**
- ✅ Mata processos na porta 3000
- ✅ Limpa cache do Next.js
- ✅ Inicia servidor imediatamente
- ✅ **Mais rápido e direto**

### **Para Reinicialização Rápida:**
```bash
npm run quick-restart
```
**O que faz:**
- ✅ Mata todos os processos Node.js
- ✅ Limpa cache
- ✅ Detecta pnpm/npm automaticamente
- ✅ Inicia servidor

### **Para Reinicialização Completa (Quando há problemas):**
```bash
npm run restart
```
**O que faz:**
- ✅ Mata processos
- ✅ Verifica Node.js e npm
- ✅ Instala dependências se necessário
- ✅ Limpa cache completo
- ✅ Inicia servidor

---

## 🔧 **COMANDOS DE VERIFICAÇÃO**

### **Verificar Configurações:**
```bash
npm run check-env
```
**Verifica:**
- ✅ Variáveis do Supabase
- ✅ Configurações da Meta API
- ✅ URLs da aplicação

### **Teste Completo do Sistema:**
```bash
npm run test-system
```
**Testa:**
- ✅ Estrutura de arquivos
- ✅ Sintaxe de componentes
- ✅ Dependências
- ✅ Configurações

---

## 📊 **COMANDOS DE BANCO DE DADOS**

### **Aplicar Schema Completo:**
```bash
npm run apply-schema
```
**Aplica:**
- ✅ Tabelas de funcionalidades avançadas
- ✅ Sistema de notificações
- ✅ Workflows e automações
- ✅ Monitoramento

---

## 🎯 **FLUXO RECOMENDADO**

### **1. Primeira Vez / Problemas:**
```bash
npm run check-env     # Verificar configurações
npm run restart       # Reinicialização completa
```

### **2. Uso Diário (Desenvolvimento):**
```bash
npm run start-dev     # Mais rápido e simples
```
**OU**
```bash
npm run quick-restart # Se preferir o quick-restart
```

### **3. Quando Algo Não Funciona:**
```bash
npm run restart       # Reinicialização completa
npm run test-system   # Verificar o que está errado
```

---

## 🚨 **SOLUÇÃO DE PROBLEMAS**

### **Problema: "Porta 3000 ocupada"**
```bash
npm run start-dev     # Mata automaticamente processos na porta
```

### **Problema: "Dependências não encontradas"**
```bash
npm run restart       # Instala dependências automaticamente
```

### **Problema: "Erro de cache"**
```bash
npm run quick-restart # Limpa cache do Next.js
```

### **Problema: "Variáveis de ambiente"**
```bash
npm run check-env     # Verifica configuração do .env
```

---

## 📱 **ACESSO AO SISTEMA**

Após iniciar qualquer script, acesse:

### **URLs Principais:**
- 🏠 **Home**: http://localhost:3000
- 📊 **Dashboard**: http://localhost:3000/dashboard
- 👑 **Admin**: http://localhost:3000/admin
- 🎯 **Onboarding**: http://localhost:3000/onboarding

### **Funcionalidades Admin:**
- 📈 **Campanhas**: http://localhost:3000/admin/campaigns
- 💰 **Saldo**: http://localhost:3000/admin/balance
- 🔗 **UTM**: http://localhost:3000/admin/utm
- 🤖 **IA**: http://localhost:3000/admin/ai-agent
- 🧠 **LLM**: http://localhost:3000/admin/llm-config

---

## ⭐ **DICA PRINCIPAL**

### **Para uso diário, use sempre:**
```bash
npm run start-dev
```

**É o mais rápido, simples e eficiente!** 🚀

---

## 📋 **RESUMO DOS SCRIPTS**

| Comando | Uso | Velocidade | Quando Usar |
|---------|-----|------------|-------------|
| `start-dev` | 🥇 **Mais usado** | ⚡ Muito rápido | Desenvolvimento diário |
| `quick-restart` | 🥈 Alternativa | ⚡ Rápido | Quando start-dev não funciona |
| `restart` | 🥉 Completo | 🐌 Mais lento | Problemas ou primeira vez |
| `check-env` | 🔍 Verificação | ⚡ Instantâneo | Verificar configurações |
| `test-system` | 🧪 Teste | 🐌 Lento | Diagnosticar problemas |

---

**💡 LEMBRE-SE: Use `npm run start-dev` para 90% dos casos!** ✨