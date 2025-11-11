# Correção: Erro 404 na API save-selected

## 🔍 Problema Identificado

A API `/api/meta/save-selected` está retornando 404 mesmo existindo o arquivo correto em:
```
src/app/api/meta/save-selected/route.ts
```

## ✅ Causa

O servidor Next.js não reconheceu a rota após mudanças recentes. Isso acontece quando:
- O cache do Next.js (.next) fica desatualizado
- O servidor não foi reiniciado após mudanças na estrutura de rotas
- Há processos Node.js antigos ainda rodando

## 🔧 Solução

### Opção 1: Script Automático (Recomendado)
```bash
scripts\reiniciar-servidor-meta.bat
```

Este script:
1. Para todos os processos Node.js
2. Limpa o cache do Next.js
3. Reinicia o servidor

### Opção 2: Manual

1. **Parar o servidor atual:**
   - Pressione `Ctrl+C` no terminal onde o servidor está rodando
   - Ou execute: `taskkill /F /IM node.exe`

2. **Limpar cache:**
   ```bash
   rmdir /s /q .next
   ```

3. **Reiniciar servidor:**
   ```bash
   npm run dev
   ```

## 📝 Verificação

Após reiniciar, a rota deve funcionar:
- URL: `http://localhost:3000/api/meta/save-selected`
- Método: POST
- Status esperado: 200 (com dados válidos) ou 400/401 (sem dados)

## 🎯 O Que NÃO Foi Alterado

✅ O fluxo Meta OAuth continua funcionando normalmente
✅ A página de seleção de contas está intacta
✅ A API save-selected tem o código correto
✅ Nenhuma lógica de negócio foi modificada

## 🚀 Próximos Passos

1. Execute o script de reinicialização
2. Teste o fluxo completo de conexão Meta
3. Verifique se as contas são salvas corretamente

## 📊 Status das Rotas Meta

```
✅ /api/meta/accounts       - Buscar contas
✅ /api/meta/auth           - Iniciar OAuth
✅ /api/meta/callback       - Callback OAuth
✅ /api/meta/campaigns      - Listar campanhas
✅ /api/meta/insights       - Métricas
✅ /api/meta/save-selected  - Salvar contas (PRECISA REINICIAR)
✅ /api/meta/sync           - Sincronizar dados
✅ /api/meta/sync-campaigns - Sincronizar campanhas
```

## 💡 Prevenção

Para evitar este problema no futuro:
1. Sempre reinicie o servidor após mudanças em rotas
2. Limpe o cache regularmente durante desenvolvimento
3. Use `npm run dev` ao invés de `next dev` diretamente
