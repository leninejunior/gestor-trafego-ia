# WhatsApp OpenClaw Webhook MVP

## Endpoint

- `POST /api/whatsapp/webhook`
- `POST /api/openclaw/webhook`
- `GET /api/whatsapp/webhook` (health/info)
- `GET /api/openclaw/webhook` (health/info)

## Authorization

If `WHATSAPP_WEBHOOK_SECRET` is set, send one of these headers:

- `x-whatsapp-webhook-secret: <secret>`
- `x-openclaw-secret: <secret>`
- `Authorization: Bearer <secret>`

Fallback:

- `Authorization: Bearer sk_...` (active API key) is also accepted when secret does not match.

## Accepted Payload (MVP)

Simple format:

```json
{
  "groupId": "1203...@g.us",
  "senderId": "5511999999999@s.whatsapp.net",
  "messageId": "abc",
  "text": "/campanhas"
}
```

Also accepts common event structure with `data.key.remoteJid` + `data.message.conversation`.

## OpenClaw Agent-Mention Payload

The webhook also accepts this style:

```json
{
  "event": "whatsapp_mention",
  "group_id": "grupo-producao-123",
  "group_alias": "Financeiro Cliente X",
  "sender": {
    "name": "Junior",
    "jid": "+556792208049@s.whatsapp.net",
    "role": "cliente"
  },
  "message": "@Edith saldo",
  "intent": "saldo_conta",
  "client": {
    "id": "e3ab33da-79f9-45e9-a43f-6ce76ceb9751",
    "meta_account_id": "act_987654321",
    "token_ref": "meta/cliente-x.token",
    "tz": "America/Sao_Paulo"
  },
  "parameters": {
    "metric": "saldo",
    "period": "today"
  },
  "timestamp": "2026-03-21T12:00:00-03:00"
}
```

Implemented compatibility:

- `message` as plain text (in addition to `text`).
- `sender.jid` used for sender whitelist.
- `intent` + `parameters` mapped to supported commands.
- `client.id` (UUID) used for auto-bind.
- `client.id` textual alias is accepted and resolved by `clients.name` (exact normalized match).
- `client.meta_account_id` can resolve `client_id` through `client_meta_connections.ad_account_id` when `client.id` is absent.
- `group_alias` / `group_name` can auto-resolve `client_id` by `clients.name` when `client.id` is absent.

Intent mapping:

- `saldo_conta`, `saldo`, `gasto`, `gasto_diario`, `gasto_semanal`, `performance`, `performance_resumo` => `/insights`
- `campanhas_ativas`, `status_campanhas` => `/campanhas`
- `pausar_campanha` => `/pausar <campaign_id>`
- `ativar_campanha`, `ligar_campanha`, `retomar_campanha` => `/ligar <campaign_id>`

## Tables

Apply migration:

- `database/migrations/08-create-whatsapp-openclaw-tables.sql`

Created tables:

- `whatsapp_group_bindings`
- `whatsapp_command_audit_logs`

## Group Bind Example

```sql
insert into whatsapp_group_bindings (
  group_id,
  group_name,
  client_id,
  can_read,
  can_manage_campaigns,
  allowed_sender_ids
) values (
  '1203XXXXXXXX@g.us',
  'Cliente XPTO - Performance',
  '00000000-0000-0000-0000-000000000000',
  true,
  true,
  array['5511999999999@s.whatsapp.net']
);
```

## Commands

- `/campanhas`
- `/insights`
- `/pausar <campaign_id>`
- `/ligar <campaign_id>`
- `/ajuda`

## Auto-Bind Mode (OpenClaw)

Without manual group registration:

- OpenClaw sends `client_id` (UUID) in webhook payload.
- On first group message, the system creates/updates binding in `whatsapp_group_bindings`.

Accepted hint fields:

- `client_id` or `clientId` at root.
- `client.id` (UUID or textual alias).
- `context.client_id` / `context.clientId`.
- `data.client_id` / `data.clientId`.
- `metadata.client_id` / `metadata.clientId`.
- `client.meta_account_id` (resolved by Meta account id).
- `group_alias` / `group_name` (resolved by `clients.name`).

Example:

```json
{
  "groupId": "1203...@g.us",
  "group_name": "Cliente XPTO - Performance",
  "senderId": "5511999999999@s.whatsapp.net",
  "text": "/ajuda",
  "client_id": "e3ab33da-79f9-45e9-a43f-6ce76ceb9751"
}
```

Note:

- Initial auto-bind creates default permissions: `can_read=true` and `can_manage_campaigns=false`.
- Endpoint returns `replyText` for OpenClaw to post back into the group.

## Admin API: Dynamic Group Binding

Endpoint:

- `GET /api/admin/whatsapp/group-bindings`
- `POST /api/admin/whatsapp/group-bindings` (create or upsert by `group_id`)
- `PATCH /api/admin/whatsapp/group-bindings` (partial update by `group_id`)
- `DELETE /api/admin/whatsapp/group-bindings` (soft disable by default)

Auth:

- Uses existing admin auth middleware (`checkAdminAuth`).
- Requires authenticated admin/super-admin session.

### Create or Update (POST)

```json
{
  "group_id": "1203XXXXXXXX@g.us",
  "group_name": "Cliente XPTO - Performance",
  "client_id": "e3ab33da-79f9-45e9-a43f-6ce76ceb9751",
  "can_read": true,
  "can_manage_campaigns": false,
  "allowed_sender_ids": ["5511999999999@s.whatsapp.net"],
  "is_active": true
}
```

### Update permissions (PATCH)

```json
{
  "group_id": "1203XXXXXXXX@g.us",
  "can_manage_campaigns": true,
  "allowed_sender_ids": []
}
```

### Disable binding (DELETE, soft)

```json
{
  "group_id": "1203XXXXXXXX@g.us"
}
```

Hard delete:

```json
{
  "group_id": "1203XXXXXXXX@g.us",
  "hard_delete": true
}
```
