# ✅ Solução: Páginas Meta Não Aparecem

## 🎯 Problema Resolvido

As conexões antigas foram limpas. Agora você pode reconectar com as permissões corretas.

## 📋 Passos para Reconectar (FAÇA AGORA)

### 1. Abra o Dashboard
```
http://localhost:3000/dashboard/clients
```

### 2. Escolha um Cliente
Você tem os seguintes clientes disponíveis:
- Dr Hernia Bauru
- coan
- Cliente A - E-commerce
- Cliente B - Serviços
- Cliente C - Imobiliária

### 3. Clique em "Conectar Meta Ads"

### 4. Autorize TODAS as Permissões
⚠️ **IMPORTANTE:** Quando o Facebook pedir permissões, autorize TODAS:
- ✅ Gerenciar anúncios
- ✅ Ler dados de anúncios
- ✅ Gerenciar negócios
- ✅ **Acessar páginas** ← CRÍTICO!
- ✅ Ler engajamento de páginas

### 5. Selecione Contas e Páginas
Agora você deve ver:
- ✅ Lista de contas de anúncios
- ✅ **Lista de páginas do Facebook** ← Deve aparecer agora!

### 6. Salve a Conexão

## 🔍 Se as Páginas Ainda Não Aparecerem

### Teste no Console do Navegador:

1. Na página de seleção, abra o Console (F12)
2. Cole e execute:

```javascript
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('access_token');

// Testar busca de páginas
fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${token}&fields=id,name,category&limit=100`)
  .then(r => r.json())
  .then(data => {
    console.log('📄 Páginas encontradas:', data.data?.length || 0);
    if (data.data?.length > 0) {
      data.data.forEach(page => console.log(`  - ${page.name}`));
    } else {
      console.log('⚠️ Nenhuma página encontrada');
      console.log('Erro:', data.error);
    }
  });

// Verificar permissões
fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${token}`)
  .then(r => r.json())
  .then(data => {
    const granted = data.data.filter(p => p.status === 'granted').map(p => p.permission);
    console.log('🔐 Permissões:', granted);
    console.log('Tem pages_show_list?', granted.includes('pages_show_list'));
  });
```

### Possíveis Causas:

1. **Você não é admin de nenhuma página**
   - Solução: Peça acesso de admin em uma página do Facebook

2. **Permissões não foram concedidas**
   - Solução: Reconecte e autorize TODAS as permissões

3. **Token expirou durante o processo**
   - Solução: Recomece o processo de conexão

## 📞 Scripts de Diagnóstico

```bash
# Ver status atual
node scripts/reconectar-meta-com-paginas.js

# Limpar e reconectar (se necessário)
node scripts/limpar-e-reconectar-meta.js --confirmar

# Diagnosticar problema
node scripts/diagnosticar-paginas-meta.js
```

## ✅ Checklist

- [x] Conexões antigas limpas
- [ ] Reconectado via interface
- [ ] Autorizadas TODAS as permissões
- [ ] Páginas aparecem na lista
- [ ] Contas e páginas selecionadas
- [ ] Conexão salva com sucesso

## 🎉 Resultado Esperado

Após seguir os passos, você deve ver:

```
┌─────────────────────────────────────┐
│ Contas de Anúncios (X)              │
├─────────────────────────────────────┤
│ ☑ Conta 1                           │
│ ☑ Conta 2                           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Páginas do Facebook (Y)             │  ← DEVE APARECER!
├─────────────────────────────────────┤
│ ☑ Página 1                          │
│ ☑ Página 2                          │
└─────────────────────────────────────┘
```

---

**Status:** ✅ Conexões limpas - Pronto para reconectar
**Próximo Passo:** Abra http://localhost:3000/dashboard/clients e reconecte
