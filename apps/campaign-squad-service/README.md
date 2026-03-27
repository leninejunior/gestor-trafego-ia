# Campaign Squad Service

Microservice responsável pelo fluxo de campanhas com squad de agentes:

- Planejamento de campanha
- Geração de criativos e copy
- Aprovação no painel principal
- Envio opcional para WhatsApp (notificação + link)
- Publicação em Meta e Google
- Retry com fila e DLQ (BullMQ)

## Variáveis

Copie `.env.example` para `.env`.

## Execução

```bash
npm install
npm run dev
```

### Smoke test do fluxo

Com o serviço já rodando:

```bash
npm run smoke:flow
```

Variáveis opcionais para o smoke:

- `CAMPAIGN_SQUAD_SMOKE_BASE_URL` (default `http://localhost:4010`)
- `CAMPAIGN_SQUAD_INTERNAL_SECRET`
- `CAMPAIGN_SQUAD_SMOKE_ORG_ID` (default `default`)
- `CAMPAIGN_SQUAD_SMOKE_CLIENT_ID` (default `smoke-client`)
- `CAMPAIGN_SQUAD_SMOKE_WHATSAPP_PHONE` (default `65999999999`)

## Docker Desktop

1. Abra o Docker Desktop e aguarde o engine ficar em `Running`.
2. Suba serviço + Redis:

```bash
docker compose up -d --build
```

3. Verifique saúde:

```bash
curl http://localhost:4010/health
```

4. Para parar:

```bash
docker compose down
```

### MinIO local (S3 compatível)

- API: `http://localhost:9000`
- Console: `http://localhost:9001`
- Credenciais padrão do compose:
  - `minioadmin`
  - `minioadmin`
- Para URL pública local funcionar diretamente no navegador:
  - `MINIO_BUCKET_PUBLIC_READ=true`

## Endpoints

- `GET /health`
- `POST /runs`
- `GET /runs/:runId`
- `GET /schedules`
- `POST /schedules`
- `PATCH /schedules/:scheduleId`
- `POST /schedules/trigger-due`
- `POST /approvals/:approvalId`
- `GET /llm-configs`
- `POST /llm-configs`
- `POST /runs/:runId/share/whatsapp`
- `POST /uploads/ready-creative`

## Documentacao de evolucao (V2)

Documentos de referencia para a evolucao conversacional com RAG por cliente:
- `docs/plano-campaign-squad-mvp.md` (plano consolidado V2)
- `docs/campaign-squad-conversational-rag-spec.md` (especificacao tecnica detalhada)
- `docs/jira-backlog-campaign-squad.md` (backlog detalhado)
- `docs/jira-campaign-squad-backlog.csv` (backlog tabular para importacao)

## Criativos prontos no run

`POST /runs` aceita `readyCreatives` (opcional), permitindo subir peças já prontas para o squad usar no primeiro ciclo de criação:

```json
{
  "readyCreatives": [
    {
      "type": "image",
      "title": "Banner oferta março",
      "storageUrl": "https://cdn.exemplo.com/banner-marco.png"
    },
    {
      "type": "copy",
      "title": "Copy principal",
      "content": "Texto pronto para anúncio"
    }
  ]
}
```

Também é possível enviar arquivo para MinIO primeiro via `POST /uploads/ready-creative` e usar o `storageUrl` retornado em `readyCreatives`.

## Notas de Publicação Real

- O publisher de Meta usa `client_meta_connections` no Supabase e exige `META_DEFAULT_PAGE_ID` (ou `publicationConfig.meta.pageId` por run).
- O publisher de Google usa `google_ads_connections` e pode renovar token com `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`.
- Ambos exigem `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no microserviço.

