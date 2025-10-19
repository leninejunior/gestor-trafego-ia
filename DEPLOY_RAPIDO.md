# 🚀 Guia Rápido de Deploy

## Passo a Passo Simplificado

### 1️⃣ Verificar Sistema (2 min)
```bash
npm run pre-deploy
```

Se aparecer ✅, pode continuar. Se aparecer ❌, corrija os erros.

### 2️⃣ Preparar Git (3 min)
```bash
# Ver o que vai ser commitado
git status

# Adicionar arquivos
git add .

# Commitar
git commit -m "feat: preparação para deploy em produção"

# Push para GitHub
git push origin main
```

### 3️⃣ Deploy na Vercel (5 min)

#### Primeira vez:
1. Acesse: https://vercel.com
2. Clique em **"Add New Project"**
3. Importe seu repositório do GitHub
4. Configure:
   - Framework: **Next.js** (detectado automaticamente)
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`

5. **Adicione as variáveis de ambiente** (copie do seu `.env`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   META_APP_ID=...
   META_APP_SECRET=...
   NEXT_PUBLIC_APP_URL=https://seu-projeto.vercel.app
   ```

6. Clique em **"Deploy"**

#### Deploys seguintes:
```bash
git push origin main
```
A Vercel faz deploy automático! 🎉

### 4️⃣ Configurar Meta App (5 min)

1. Acesse: https://developers.facebook.com/apps/1582506459384854
2. Vá em **Configurações > Básico**
3. Adicione seu domínio Vercel em **"Domínios do App"**
4. Em **Produtos > Login do Facebook > Configurações**
5. Adicione em **"URIs de redirecionamento OAuth válidos"**:
   ```
   https://seu-projeto.vercel.app/api/meta/callback
   https://seu-projeto.vercel.app/meta/select-accounts
   ```

### 5️⃣ Testar (2 min)

1. Acesse: `https://seu-projeto.vercel.app`
2. Faça login
3. Crie um cliente
4. Conecte Meta Ads
5. Verifique se campanhas aparecem

## ✅ Pronto!

Seu sistema está no ar! 🎉

## 🔧 Comandos Úteis

```bash
# Ver logs em tempo real
vercel logs --follow

# Ver logs de produção
vercel logs --prod

# Fazer redeploy
vercel --prod

# Ver status
vercel ls
```

## 🐛 Problemas Comuns

### "Module not found"
```bash
rm -rf node_modules .next
npm install
git push origin main
```

### "Supabase connection failed"
- Verifique variáveis de ambiente na Vercel
- Confirme que as URLs estão corretas

### "Meta OAuth redirect mismatch"
- Verifique URLs no Meta Developer Console
- Aguarde 5-10 minutos para propagação

## 📞 Precisa de Ajuda?

Veja o guia completo: [DEPLOY_PRODUCTION.md](./DEPLOY_PRODUCTION.md)

---

**Tempo total estimado**: 15-20 minutos
