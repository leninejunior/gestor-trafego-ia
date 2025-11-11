# Problema: Páginas Meta Não Aparecem na Seleção

## 🔍 Diagnóstico

Você está conseguindo conectar a conta Meta Ads e selecionar contas de anúncios, mas as páginas do Facebook não aparecem na lista de seleção.

## 🎯 Causa Provável

O token de acesso atual **não possui as permissões necessárias** para acessar as páginas do Facebook. Isso acontece quando:

1. A conexão foi feita antes das permissões de páginas serem adicionadas
2. O usuário não autorizou o acesso às páginas durante o OAuth
3. O token expirou e foi renovado sem as permissões corretas

## ✅ Solução

### Opção 1: Reconectar via Interface (RECOMENDADO)

1. **Limpar conexão antiga:**
   ```bash
   node scripts/limpar-e-reconectar-meta.js
   ```

2. **Reconectar:**
   - Acesse: http://localhost:3000/dashboard/clients
   - Clique em "Conectar Meta Ads" no cliente desejado
   - **IMPORTANTE:** Autorize TODAS as permissões, especialmente:
     - ✅ Gerenciar anúncios
     - ✅ Ler dados de anúncios
     - ✅ Gerenciar negócios
     - ✅ **Acessar páginas** ← CRÍTICO!
     - ✅ Ler engajamento de páginas

3. **Selecionar contas e páginas:**
   - Após autorizar, você verá a tela de seleção
   - Agora as páginas devem aparecer!

### Opção 2: Diagnóstico Detalhado

Se as páginas ainda não aparecerem, execute o diagnóstico:

```bash
node scripts/diagnosticar-paginas-meta.js
```

Ou teste direto no navegador:
1. Abra: http://localhost:3000/meta/select-accounts?access_token=SEU_TOKEN&client_id=SEU_CLIENT_ID
2. Abra o Console (F12)
3. Cole o conteúdo de `scripts/testar-paginas-meta-navegador.js`
4. Execute

## 🔐 Permissões Necessárias

O sistema solicita as seguintes permissões (configuradas em `src/lib/meta/config.ts`):

```typescript
export const META_SCOPES = [
    'ads_management',        // Gerenciar anúncios
    'ads_read',             // Ler dados de anúncios
    'business_management',   // Gerenciar negócios
    'pages_read_engagement', // Ler engajamento de páginas ← PARA PÁGINAS
    'pages_show_list',      // Listar páginas ← PARA PÁGINAS
];
```

## 🐛 Como Verificar se o Problema é de Permissões

### No Console do Navegador:

```javascript
// Na página de seleção, abra o console e execute:
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('access_token');

// Verificar permissões
fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${token}`)
  .then(r => r.json())
  .then(data => {
    const granted = data.data.filter(p => p.status === 'granted').map(p => p.permission);
    console.log('Permissões concedidas:', granted);
    console.log('Tem pages_show_list?', granted.includes('pages_show_list'));
    console.log('Tem pages_read_engagement?', granted.includes('pages_read_engagement'));
  });
```

### Resultado Esperado:
```
Permissões concedidas: ["ads_management", "ads_read", "business_management", "pages_read_engagement", "pages_show_list"]
Tem pages_show_list? true
Tem pages_read_engagement? true
```

## 📝 Notas Importantes

1. **Token Expirado:** Se o token expirou, você precisa reconectar completamente
2. **Páginas do Business Manager:** Algumas páginas só aparecem se você tiver permissão no Business Manager
3. **Admin da Página:** Você precisa ser admin ou editor da página para ela aparecer
4. **Primeira Conexão:** Na primeira vez, o Facebook pode pedir confirmação adicional

## 🔄 Fluxo Correto de Conexão

```
1. Usuário clica em "Conectar Meta Ads"
   ↓
2. Sistema redireciona para Facebook OAuth
   ↓
3. Facebook solicita permissões (incluindo páginas)
   ↓
4. Usuário AUTORIZA TODAS as permissões
   ↓
5. Facebook redireciona de volta com código
   ↓
6. Sistema troca código por access_token
   ↓
7. Sistema busca contas E páginas
   ↓
8. Usuário vê lista completa para selecionar
```

## 🚨 Problemas Comuns

### Problema: "Nenhuma página encontrada"
**Causa:** Token sem permissão de páginas
**Solução:** Reconectar e autorizar permissões de páginas

### Problema: "Algumas páginas não aparecem"
**Causa:** Você não é admin dessas páginas
**Solução:** Peça acesso de admin nas páginas desejadas

### Problema: "Erro ao buscar páginas"
**Causa:** Token expirado ou inválido
**Solução:** Limpar conexão e reconectar

## 📞 Scripts Úteis

```bash
# Verificar conexões existentes
node scripts/verificar-contas-meta-reais.js

# Limpar e reconectar
node scripts/limpar-e-reconectar-meta.js

# Diagnosticar problema de páginas
node scripts/diagnosticar-paginas-meta.js

# Testar busca de páginas
node scripts/testar-busca-paginas-meta.js
```

## ✅ Checklist de Solução

- [ ] Limpar conexões antigas
- [ ] Reconectar via interface
- [ ] Autorizar TODAS as permissões (especialmente páginas)
- [ ] Verificar se as páginas aparecem na seleção
- [ ] Selecionar contas e páginas desejadas
- [ ] Salvar conexão
- [ ] Verificar se dados estão sendo sincronizados

---

**Última atualização:** 11/11/2025
**Status:** Documentado e com scripts de diagnóstico prontos
