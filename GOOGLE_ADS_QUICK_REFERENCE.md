# 🚀 Google Ads - Referência Rápida

## 📍 Onde Encontrar Cada Coisa

### 🎯 Começando
- **Troubleshooting geral**: [GOOGLE_ADS_SOLUCAO_COMPLETA.md](./GOOGLE_ADS_SOLUCAO_COMPLETA.md)
- **Índice completo**: [GOOGLE_ADS_INDEX.md](./GOOGLE_ADS_INDEX.md)
- **Documentação v22**: [docs/GOOGLE_ADS_README.md](./docs/GOOGLE_ADS_README.md)

### 📖 Guias Principais
| Guia | Arquivo | Quando Usar |
|------|---------|-------------|
| Setup Inicial | [docs/GOOGLE_ADS_V22_SETUP_GUIDE.md](./docs/GOOGLE_ADS_V22_SETUP_GUIDE.md) | Primeira configuração |
| Implementação | [docs/GOOGLE_ADS_V22_IMPLEMENTATION.md](./docs/GOOGLE_ADS_V22_IMPLEMENTATION.md) | Entender o código |
| Deploy | [docs/GOOGLE_ADS_V22_DEPLOYMENT.md](./docs/GOOGLE_ADS_V22_DEPLOYMENT.md) | Subir para produção |
| Validação | [docs/GOOGLE_ADS_V22_VALIDATION_GUIDE.md](./docs/GOOGLE_ADS_V22_VALIDATION_GUIDE.md) | Testar integração |
| Exemplos | [docs/GOOGLE_ADS_V22_EXAMPLES.md](./docs/GOOGLE_ADS_V22_EXAMPLES.md) | Ver código prático |
| Migração | [docs/GOOGLE_ADS_V22_MIGRATION.md](./docs/GOOGLE_ADS_V22_MIGRATION.md) | Migrar de v18 |

### 🔧 Documentação Técnica
| Tipo | Arquivo | Conteúdo |
|------|---------|----------|
| Database | [database/GOOGLE_ADS_SCHEMA_REFERENCE.md](./database/GOOGLE_ADS_SCHEMA_REFERENCE.md) | Schema e tabelas |
| Repository | [src/lib/repositories/README-google-ads-repository.md](./src/lib/repositories/README-google-ads-repository.md) | Camada de dados |
| Sync | [src/lib/sync/README-google-ads.md](./src/lib/sync/README-google-ads.md) | Sincronização |
| Tests | [src/__tests__/README-google-ads-tests.md](./src/__tests__/README-google-ads-tests.md) | Testes |

### 🛠️ Scripts Úteis
| Script | Localização | Uso |
|--------|-------------|-----|
| Validação v22 | `scripts/test-google-ads-v22.js` | Testar migração |
| Validação Config | `scripts/test-google-ads-config.js` | Testar configuração |
| Cleanup Test Data | `database/cleanup-google-test-data.sql` | Limpar dados de teste |
| Setup & Cleanup | `database/setup-and-cleanup-google-ads.sql` | Reset completo |

## 🔍 Problemas Comuns

### Erro 501 (Not Implemented)
→ Ver: [GOOGLE_ADS_SOLUCAO_COMPLETA.md](./GOOGLE_ADS_SOLUCAO_COMPLETA.md)

### OAuth não funciona
→ Ver: [docs/GOOGLE_ADS_V22_SETUP_GUIDE.md](./docs/GOOGLE_ADS_V22_SETUP_GUIDE.md) - Seção OAuth

### Contas não aparecem
→ Ver: [docs/GOOGLE_ADS_V22_VALIDATION_GUIDE.md](./docs/GOOGLE_ADS_V22_VALIDATION_GUIDE.md)

### Migração de v18
→ Ver: [MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md)

## 📊 Estrutura de Arquivos

```
.
├── GOOGLE_ADS_INDEX.md                    # 📍 COMECE AQUI
├── GOOGLE_ADS_SOLUCAO_COMPLETA.md         # 🔧 Troubleshooting
├── GOOGLE_ADS_QUICK_REFERENCE.md          # ⚡ Este arquivo
├── GOOGLE_ADS_CLEANUP_SUMMARY.md          # 🧹 Resumo da limpeza
├── MIGRATION_COMPLETE.md                  # 📦 Migração v18→v22
│
├── docs/
│   ├── GOOGLE_ADS_README.md               # 📚 Índice v22
│   ├── GOOGLE_ADS_V22_SETUP_GUIDE.md      # 🚀 Setup
│   ├── GOOGLE_ADS_V22_IMPLEMENTATION.md   # 💻 Implementação
│   ├── GOOGLE_ADS_V22_DEPLOYMENT.md       # 🚢 Deploy
│   ├── GOOGLE_ADS_V22_VALIDATION_GUIDE.md # ✅ Validação
│   ├── GOOGLE_ADS_V22_EXAMPLES.md         # 📝 Exemplos
│   └── ... (mais 6 arquivos v22)
│
├── database/
│   ├── GOOGLE_ADS_SCHEMA_REFERENCE.md     # 🗄️ Schema
│   └── ... (scripts SQL)
│
└── src/
    ├── lib/
    │   ├── repositories/README-google-ads-repository.md
    │   └── sync/README-google-ads.md
    └── __tests__/README-google-ads-tests.md
```

## ⚡ Comandos Rápidos

```bash
# Testar configuração
node scripts/test-google-ads-config.js

# Validar migração v22
node scripts/test-google-ads-v22.js

# Iniciar dev
pnpm dev

# Acessar dashboard Google Ads
# http://localhost:3000/dashboard/google
```

## 🎯 Checklist Rápido

### Setup Inicial
- [ ] Variáveis de ambiente configuradas
- [ ] OAuth configurado no Google Cloud
- [ ] Developer Token obtido
- [ ] Migrações do banco executadas
- [ ] Teste de conexão realizado

### Deploy
- [ ] Variáveis de produção configuradas
- [ ] Testes passando
- [ ] Documentação revisada
- [ ] Backup do banco realizado
- [ ] Deploy executado

### Troubleshooting
- [ ] Logs verificados
- [ ] Tokens validados
- [ ] Conexões testadas
- [ ] Documentação consultada
- [ ] Suporte contatado (se necessário)

## 📞 Suporte

1. **Documentação**: Consulte os guias acima
2. **Logs**: Verifique console e servidor
3. **Scripts**: Execute os scripts de validação
4. **Google**: [Google Ads API Docs](https://developers.google.com/google-ads/api/docs)

---

**Última atualização**: 21 de Novembro de 2024  
**Versão**: Google Ads API v22  
**Status**: ✅ Produção
