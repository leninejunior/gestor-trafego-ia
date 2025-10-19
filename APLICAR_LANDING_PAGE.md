# 🚀 Guia Rápido: Aplicar Landing Page

## Passo 1: Aplicar Schema no Banco de Dados

Execute o script para criar a tabela de leads:

```bash
npm run apply-landing-schema
```

**Ou manualmente no Supabase:**
1. Acesse o Supabase Dashboard
2. Vá em SQL Editor
3. Copie o conteúdo de `database/landing-leads-schema.sql`
4. Execute o SQL

## Passo 2: Verificar Variáveis de Ambiente

Certifique-se de ter no `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
```

## Passo 3: Testar Localmente

```bash
npm run dev
```

### Testar Landing Page:
1. Acesse `http://localhost:3000/`
2. Navegue pelas seções
3. Preencha o formulário de contato
4. Verifique a mensagem de sucesso

### Testar Painel Admin:
1. Faça login como super admin
2. Acesse `http://localhost:3000/admin/leads`
3. Visualize os leads capturados
4. Teste a alteração de status

## 🎯 O Que Foi Implementado

### Landing Page (`/`)
- ✅ Hero section com apresentação do sistema
- ✅ Grid de recursos principais (6 cards)
- ✅ Showcase de integrações (Meta, Google, WhatsApp)
- ✅ Lista de benefícios
- ✅ Cards de público-alvo
- ✅ Formulário de contato completo
- ✅ Footer profissional
- ✅ Design responsivo e moderno

### Formulário de Contato
- ✅ Nome completo (obrigatório)
- ✅ Email (obrigatório)
- ✅ Telefone (opcional)
- ✅ Empresa (opcional)
- ✅ Tipo de lead (obrigatório):
  - Agência de Marketing
  - Empresa
  - Gestor de Tráfego
  - Social Media
  - Outro
- ✅ Mensagem (opcional)
- ✅ Validação de campos
- ✅ Toast de confirmação

### Painel Admin (`/admin/leads`)
- ✅ Dashboard com estatísticas:
  - Total de leads
  - Leads novos
  - Leads contatados
  - Leads convertidos
- ✅ Filtros por status e tipo
- ✅ Tabela completa de leads
- ✅ Atualização de status em tempo real
- ✅ Badges coloridos por status
- ✅ Interface responsiva

### Segurança
- ✅ RLS policies configuradas
- ✅ Inserção pública permitida (formulário)
- ✅ Apenas super admins visualizam leads
- ✅ Apenas super admins editam leads
- ✅ Validação de email
- ✅ Sanitização de inputs

## 📊 Status dos Leads

| Status | Cor | Descrição |
|--------|-----|-----------|
| Novo | Azul | Lead recém-capturado |
| Contatado | Amarelo | Primeiro contato realizado |
| Qualificado | Roxo | Lead qualificado para venda |
| Convertido | Verde | Lead virou cliente |
| Perdido | Vermelho | Lead não converteu |

## 🔗 Links Importantes

- Landing Page: `/`
- Painel de Leads: `/admin/leads`
- API de Captura: `/api/landing/leads`

## 📝 Próximos Passos Sugeridos

1. **Personalizar Conteúdo**
   - Ajustar textos da landing page
   - Adicionar logo da empresa
   - Customizar cores do tema

2. **Configurar Notificações**
   - Email ao receber novo lead
   - Notificação push para admins
   - Integração com Slack/Discord

3. **Analytics**
   - Adicionar Google Analytics
   - Configurar tracking de conversões
   - Implementar heatmaps

4. **SEO**
   - Otimizar meta tags
   - Adicionar schema.org markup
   - Criar sitemap.xml

5. **Deploy**
   - Fazer deploy na Vercel
   - Configurar domínio customizado
   - Testar formulário em produção

## ✅ Checklist de Verificação

- [ ] Schema aplicado no banco de dados
- [ ] Variáveis de ambiente configuradas
- [ ] Landing page acessível em `/`
- [ ] Formulário enviando dados
- [ ] Leads aparecendo em `/admin/leads`
- [ ] Filtros funcionando
- [ ] Atualização de status funcionando
- [ ] Design responsivo em mobile
- [ ] Toast notifications funcionando
- [ ] Link no menu admin visível

## 🆘 Troubleshooting

### Erro ao enviar formulário:
- Verifique as variáveis de ambiente
- Confirme que o schema foi aplicado
- Verifique o console do navegador

### Leads não aparecem no admin:
- Confirme que está logado como super admin
- Verifique as RLS policies no Supabase
- Teste a query diretamente no Supabase

### Erro de permissão:
- Verifique se o usuário tem role 'super_admin'
- Confirme as RLS policies
- Verifique os logs do Supabase

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique a documentação em `LANDING_PAGE_IMPLEMENTADA.md`
2. Consulte os logs do console
3. Verifique os logs do Supabase
4. Revise as RLS policies

---

**Sistema pronto para capturar leads! 🎉**
