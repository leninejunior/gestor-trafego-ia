# 🏗️ Arquitetura - Auth Fix

## Fluxo de Autenticação Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    USUÁRIO NOVO                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   Signup     │
                    │  (Supabase)  │
                    └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  auth.users  │
                    │   criado     │
                    └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │    Login     │
                    │  (Supabase)  │
                    └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  Middleware  │
                    │  valida JWT  │
                    └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  Dashboard   │
                    │   carrega    │
                    └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │     RLS      │
                    │   verifica   │
                    │   org_id     │
                    └──────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
                    ▼               ▼
            ┌──────────────┐  ┌──────────────┐
            │ Sem org_id   │  │ Com org_id   │
            │ ❌ Bloqueado │  │ ✅ Permitido │
            └──────────────┘  └──────────────┘
```

## Estrutura de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                         │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ auth.users (Supabase Auth)                                   │
├──────────────────────────────────────────────────────────────┤
│ id: UUID                                                     │
│ email: TEXT                                                  │
│ password_hash: TEXT                                          │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ REFERENCES
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ memberships                                                  │
├──────────────────────────────────────────────────────────────┤
│ id: UUID                                                     │
│ user_id: UUID (FK → auth.users)                             │
│ org_id: UUID (FK → organizations)                           │
│ role: TEXT                                                   │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ REFERENCES
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ organizations                                                │
├──────────────────────────────────────────────────────────────┤
│ id: UUID                                                     │
│ name: TEXT                                                   │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ REFERENCES
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ clients                                                      │
├──────────────────────────────────────────────────────────────┤
│ id: UUID                                                     │
│ name: TEXT                                                   │
│ org_id: UUID (FK → organizations)                           │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ REFERENCES
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ client_meta_connections                                      │
├──────────────────────────────────────────────────────────────┤
│ id: UUID                                                     │
│ client_id: UUID (FK → clients)                              │
│ ad_account_id: TEXT                                          │
│ access_token: TEXT                                           │
└──────────────────────────────────────────────────────────────┘
```

## Fluxo de Inicialização (Auth Fix)

```
┌─────────────────────────────────────────────────────────────┐
│              USUÁRIO LOGADO SEM DADOS                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                ┌──────────────────────────┐
                │ /debug/init-data         │
                │ (Interface Visual)       │
                └──────────────────────────┘
                            │
                            ▼
                ┌──────────────────────────┐
                │ Clique em               │
                │ "Inicializar Dados"     │
                └──────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │ POST /api/debug/init-minimal-data     │
        └───────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
    ┌────────┐         ┌────────┐         ┌────────┐
    │ CREATE │         │ CREATE │         │ CREATE │
    │  ORG   │         │ CLIENT │         │MEMBER  │
    └────────┘         └────────┘         └────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
                ┌──────────────────────────┐
                │ ✅ Sucesso!              │
                │ Dados criados            │
                └──────────────────────────┘
                            │
                            ▼
                ┌──────────────────────────┐
                │ Redirecionar para        │
                │ /dashboard               │
                └──────────────────────────┘
                            │
                            ▼
                ┌──────────────────────────┐
                │ Dashboard carrega        │
                │ com sucesso              │
                └──────────────────────────┘
```

## Políticas RLS

```
┌─────────────────────────────────────────────────────────────┐
│                    ROW LEVEL SECURITY                        │
└─────────────────────────────────────────────────────────────┘

Quando usuário tenta acessar dados:

1. Usuário faz query
   │
   ▼
2. RLS intercepta
   │
   ▼
3. RLS verifica: "Qual é o org_id do usuário?"
   │
   ▼
4. RLS busca em memberships:
   SELECT org_id FROM memberships WHERE user_id = auth.uid()
   │
   ├─ Se encontra: ✅ Permite acesso aos dados dessa org
   │
   └─ Se não encontra: ❌ Bloqueia acesso (retorna vazio)

Exemplo:

┌──────────────────────────────────────────────────────────────┐
│ Usuário tenta: SELECT * FROM clients                         │
├──────────────────────────────────────────────────────────────┤
│ RLS aplica:   WHERE org_id IN (                              │
│                 SELECT org_id FROM memberships               │
│                 WHERE user_id = auth.uid()                   │
│               )                                              │
├──────────────────────────────────────────────────────────────┤
│ Resultado:    Apenas clientes da org do usuário              │
└──────────────────────────────────────────────────────────────┘
```

## Comparação: Antes vs Depois

```
ANTES (Quebrado)
┌─────────────────────────────────────────────────────────────┐
│ auth.users: ✅ Usuário existe                               │
│ memberships: ❌ Vazio                                       │
│ organizations: ❌ Vazio                                     │
│ clients: ❌ Vazio                                           │
│ RLS: ❌ Bloqueia tudo                                       │
│ Resultado: ❌ Dashboard vazio                               │
└─────────────────────────────────────────────────────────────┘

DEPOIS (Funcionando)
┌─────────────────────────────────────────────────────────────┐
│ auth.users: ✅ Usuário existe                               │
│ memberships: ✅ user_id → org_id                            │
│ organizations: ✅ Organização criada                        │
│ clients: ✅ Cliente criado                                  │
│ RLS: ✅ Permite acesso                                      │
│ Resultado: ✅ Dashboard funciona                            │
└─────────────────────────────────────────────────────────────┘
```

## Fluxo de Dados

```
┌──────────────┐
│   Browser    │
└──────────────┘
       │
       │ 1. Login
       ▼
┌──────────────────────────────────────┐
│   Supabase Auth                      │
│   (Valida credenciais)               │
└──────────────────────────────────────┘
       │
       │ 2. JWT Token
       ▼
┌──────────────────────────────────────┐
│   Next.js Middleware                 │
│   (Valida JWT)                       │
└──────────────────────────────────────┘
       │
       │ 3. Redireciona para /dashboard
       ▼
┌──────────────────────────────────────┐
│   Dashboard Component                │
│   (Carrega dados)                    │
└──────────────────────────────────────┘
       │
       │ 4. Query: SELECT * FROM clients
       ▼
┌──────────────────────────────────────┐
│   Supabase RLS                       │
│   (Verifica org_id)                  │
└──────────────────────────────────────┘
       │
       ├─ Se org_id válido: ✅ Retorna dados
       │
       └─ Se sem org_id: ❌ Retorna vazio
```

## Segurança

```
┌─────────────────────────────────────────────────────────────┐
│                    CAMADAS DE SEGURANÇA                      │
└─────────────────────────────────────────────────────────────┘

1. Autenticação (Supabase Auth)
   └─ Valida email/senha
   └─ Gera JWT token

2. Middleware (Next.js)
   └─ Valida JWT token
   └─ Redireciona se não autenticado

3. RLS (PostgreSQL)
   └─ Filtra dados por org_id
   └─ Usuário só vê dados de suas orgs

4. Isolamento de Dados
   └─ Cada org tem seus clientes
   └─ Cada cliente tem suas conexões
   └─ Cada conexão tem seus dados

Resultado: ✅ Dados completamente isolados por organização
```

---

**Criado em**: 2025-11-20  
**Versão**: 1.0  
**Status**: ✅ Completo
