# Ferramentas de Debug - Operações DELETE

## 🎯 Objetivo
Diagnosticar e corrigir problemas com as operações de DELETE das conexões Meta Ads.

## 🛠️ Ferramentas Criadas

### 1. Página de Debug Interativa
**URL**: `http://localhost:3000/debug`

**Funcionalidades**:
- ✅ Visualizar dados do usuário (organizações, clientes, conexões)
- ✅ Testar permissões de DELETE sem executar
- ✅ Simular operações DELETE
- ✅ Interface amigável com resultados em JSON

**Como usar**:
1. Acesse `/debug` na aplicação
2. Clique em "Buscar Dados do Usuário"
3. Copie um Connection ID das conexões listadas
4. Teste as permissões antes de tentar DELETE real

### 2. API Endpoints de Debug

#### `/api/debug/user-data` (GET)
- Retorna estrutura completa de dados do usuário
- Mostra relacionamentos entre tabelas
- Identifica problemas de acesso

#### `/api/debug/test-delete` (POST)
- Testa permissões sem deletar
- Simula operações DELETE
- Parâmetros:
  ```json
  {
    "connectionId": "uuid-da-conexao",
    "testType": "check-permissions" | "simulate-delete"
  }
  ```

### 3. Scripts de Linha de Comando

#### `scripts/debug-user-data.js`
```bash
node scripts/debug-user-data.js
```
- Versão CLI do debug de dados
- Requer variáveis de ambiente configuradas

#### `scripts/test-delete-connections.js`
```bash
node scripts/test-delete-connections.js
```
- Testa operações DELETE via CLI
- Útil para automação

## 🔍 Como Diagnosticar Problemas

### Passo 1: Verificar Estrutura de Dados
1. Acesse `/debug`
2. Clique em "Buscar Dados do Usuário"
3. Verifique se há:
   - ✅ Usuário autenticado
   - ✅ Memberships existentes
   - ✅ Organizações criadas
   - ✅ Clientes associados
   - ✅ Conexões Meta existentes

### Passo 2: Testar Permissões
1. Copie um Connection ID
2. Use "Testar Permissões"
3. Verifique se retorna `success: true`

### Passo 3: Simular DELETE
1. Use "Simular DELETE"
2. Verifique se encontra registros para deletar
3. Se `wouldDelete: 0`, há problema de RLS

## 🚨 Problemas Comuns e Soluções

### Erro: "Usuário não autenticado"
**Solução**: Faça login na aplicação antes de usar o debug

### Erro: "Nenhum membership encontrado"
**Solução**: Execute o script de criação de organização:
```sql
SELECT create_org_and_add_admin();
```

### Erro: "Sem permissão para acessar"
**Solução**: Verifique se as políticas RLS foram aplicadas no Supabase

### Erro: "wouldDelete: 0"
**Solução**: Aplique as políticas RLS do arquivo `APPLY_RLS_FIX.md`

## 📋 Checklist de Correção

- [ ] Aplicar políticas RLS no Supabase
- [ ] Testar com página de debug
- [ ] Verificar se DELETE real funciona
- [ ] Remover ferramentas de debug (opcional)

## 🗑️ Limpeza (Após Correção)

Quando tudo estiver funcionando, você pode remover:
- `src/app/debug/`
- `src/app/api/debug/`
- Item "🔧 Debug DELETE" da sidebar
- Scripts de debug (opcional)

## 📞 Status Atual

- ✅ Ferramentas de debug criadas
- ✅ Relacionamentos corrigidos no código
- ⏳ Aguardando aplicação das políticas RLS
- ⏳ Teste final das funcionalidades