import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type EndpointDoc = {
  method: 'GET' | 'PATCH'
  path: string
  permission: string
  description: string
  query?: string[]
  body?: string[]
  curl: string
}

const endpoints: EndpointDoc[] = [
  {
    method: 'GET',
    path: '/api/v1/balance',
    permission: 'balance:read',
    description: 'Saldo consolidado e saldos por conta de anuncio do client_id informado.',
    query: ['client_id (obrigatorio)'],
    curl: `curl -X GET \"$BASE_URL/api/v1/balance?client_id=$CLIENT_ID\" \\
  -H \"Authorization: Bearer $API_KEY\"`
  },
  {
    method: 'GET',
    path: '/api/v1/campaigns',
    permission: 'campaigns:read',
    description:
      'Lista campanhas com status, numeros e gastos no range informado. Sem date_from/date_to aplica mes atual e retorna warning.',
    query: [
      'client_id (obrigatorio)',
      'date_from (opcional, YYYY-MM-DD)',
      'date_to (opcional, YYYY-MM-DD)',
      'status (opcional, ACTIVE|PAUSED|...)',
      'limit (opcional, 1-100)',
      'offset (opcional, >=0)'
    ],
    curl: `curl -X GET \"$BASE_URL/api/v1/campaigns?client_id=$CLIENT_ID&date_from=2026-03-01&date_to=2026-03-24\" \\
  -H \"Authorization: Bearer $API_KEY\"`
  },
  {
    method: 'GET',
    path: '/api/v1/campaigns/{campaign_id}/insights',
    permission: 'campaigns:read',
    description:
      'Insights da campanha com resumo e breakdown diario no range informado. Sem datas aplica mes atual e retorna warning.',
    query: [
      'client_id (obrigatorio)',
      'date_from (opcional, YYYY-MM-DD)',
      'date_to (opcional, YYYY-MM-DD)'
    ],
    curl: `curl -X GET \"$BASE_URL/api/v1/campaigns/$CAMPAIGN_ID/insights?client_id=$CLIENT_ID\" \\
  -H \"Authorization: Bearer $API_KEY\"`
  },
  {
    method: 'PATCH',
    path: '/api/v1/campaigns/{campaign_id}/status',
    permission: 'campaigns:write',
    description: 'Liga ou desliga campanha na Meta API com escopo validado por client_id.',
    body: ['client_id (obrigatorio)', 'status (obrigatorio: ACTIVE ou PAUSED)'],
    curl: `curl -X PATCH \"$BASE_URL/api/v1/campaigns/$CAMPAIGN_ID/status\" \\
  -H \"Authorization: Bearer $API_KEY\" \\
  -H \"Content-Type: application/json\" \\
  -d '{\"client_id\":\"$CLIENT_ID\",\"status\":\"PAUSED\"}'`
  },
  {
    method: 'PATCH',
    path: '/api/v1/campaigns/{campaign_id}/budget',
    permission: 'campaigns:write',
    description: 'Atualiza orcamento diario e/ou lifetime na Meta API com escopo validado por client_id.',
    body: [
      'client_id (obrigatorio)',
      'daily_budget (opcional, numero > 0)',
      'lifetime_budget (opcional, numero > 0)'
    ],
    curl: `curl -X PATCH \"$BASE_URL/api/v1/campaigns/$CAMPAIGN_ID/budget\" \\
  -H \"Authorization: Bearer $API_KEY\" \\
  -H \"Content-Type: application/json\" \\
  -d '{\"client_id\":\"$CLIENT_ID\",\"daily_budget\":120.50}'`
  }
]

export default function AdminApiDocsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API v1 - Integracao de IA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Contrato oficial para agentes de trafego. Todos os endpoints abaixo exigem API key e escopo por client_id.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Autenticacao e Regras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Header obrigatorio: <code>Authorization: Bearer sk_...</code>
          </p>
          <p>
            Escopo obrigatorio: <code>client_id</code> deve pertencer a organizacao da API key.
          </p>
          <p>
            Datas: quando <code>date_from</code> e <code>date_to</code> nao sao enviados, a API usa automaticamente o
            mes atual e retorna aviso em <code>meta.warnings</code>.
          </p>
          <p>
            Permissoes por chave: <code>balance:read</code>, <code>campaigns:read</code>, <code>campaigns:write</code>{' '}
            ou <code>*</code>.
          </p>
          <p>
            Observacao: <code>WHATSAPP_WEBHOOK_SECRET</code> e usado apenas nos webhooks WhatsApp/OpenClaw, nao na API
            v1.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        {endpoints.map((endpoint) => (
          <Card key={`${endpoint.method}-${endpoint.path}`}>
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={endpoint.method === 'GET' ? 'secondary' : 'default'}>{endpoint.method}</Badge>
                <code className="text-sm">{endpoint.path}</code>
              </div>
              <CardTitle className="text-base">{endpoint.description}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Permissao requerida: <code>{endpoint.permission}</code>
              </p>

              {endpoint.query && (
                <div>
                  <p className="font-medium">Query params</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {endpoint.query.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {endpoint.body && (
                <div>
                  <p className="font-medium">Body JSON</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {endpoint.body.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="font-medium mb-2">Exemplo cURL</p>
                <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
                  <code>{endpoint.curl}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Padrao de Resposta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Sucesso: <code>{`{ "data": ..., "meta": { "generated_at": "...", ... } }`}</code>
          </p>
          <p>
            Erro: <code>{`{ "error": { "code": "...", "message": "...", "details": ... } }`}</code>
          </p>
          <p>
            Cenarios comuns de erro: <code>INVALID_API_KEY</code>, <code>INSUFFICIENT_PERMISSIONS</code>,{' '}
            <code>CLIENT_SCOPE_DENIED</code>, <code>META_API_ERROR</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
