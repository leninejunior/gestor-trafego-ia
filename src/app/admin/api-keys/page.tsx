'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { Check, Copy, KeyRound, RefreshCcw, ShieldAlert } from 'lucide-react'

type Organization = {
  id: string
  name: string
  is_active: boolean
}

type ApiKeyRow = {
  id: string
  organization_id: string
  organization_name: string | null
  name: string
  key_prefix: string
  permissions: string[]
  is_active: boolean
  last_used_at: string | null
  expires_at: string | null
  created_at: string | null
  updated_at: string | null
}

type ApiKeysResponse = {
  success: boolean
  data?: {
    keys: ApiKeyRow[]
    organizations: Organization[]
  }
  error?: string
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('pt-BR')
}

function formatPermissions(permissions: string[]): string {
  if (!Array.isArray(permissions) || permissions.length === 0) return '*'
  return permissions.join(', ')
}

export default function AdminApiKeysPage() {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({})

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [keys, setKeys] = useState<ApiKeyRow[]>([])

  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [keyName, setKeyName] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const [fullAccess, setFullAccess] = useState(true)
  const [permBalanceRead, setPermBalanceRead] = useState(false)
  const [permCampaignsRead, setPermCampaignsRead] = useState(false)
  const [permCampaignsWrite, setPermCampaignsWrite] = useState(false)

  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const permissions = useMemo(() => {
    if (fullAccess) return ['*']

    const list: string[] = []
    if (permBalanceRead) list.push('balance:read')
    if (permCampaignsRead) list.push('campaigns:read')
    if (permCampaignsWrite) list.push('campaigns:write')
    return list
  }, [fullAccess, permBalanceRead, permCampaignsRead, permCampaignsWrite])

  const canCreate = selectedOrgId.length > 0 && permissions.length > 0 && !submitting

  async function loadApiKeys() {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/api-keys', { cache: 'no-store' })
      const payload = (await response.json()) as ApiKeysResponse

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Falha ao carregar API keys')
      }

      setOrganizations(payload.data.organizations)
      setKeys(payload.data.keys)
      setSelectedOrgId((prev) => {
        if (prev && payload.data?.organizations.some((org) => org.id === prev)) return prev
        return payload.data?.organizations[0]?.id ?? ''
      })
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao carregar API keys',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadApiKeys()
  }, [])

  async function handleCreateKey() {
    if (!canCreate) return

    setSubmitting(true)
    setGeneratedKey(null)
    setCopied(false)

    try {
      const body = {
        organization_id: selectedOrgId,
        name: keyName.trim() || undefined,
        permissions,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null
      }

      const response = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const payload = (await response.json()) as { success?: boolean; api_key?: string; error?: string }
      if (!response.ok || !payload.success || !payload.api_key) {
        throw new Error(payload.error || 'Falha ao criar API key')
      }

      setGeneratedKey(payload.api_key)
      setKeyName('')
      setExpiresAt('')
      setFullAccess(true)
      setPermBalanceRead(false)
      setPermCampaignsRead(false)
      setPermCampaignsWrite(false)

      toast({
        title: 'API key criada',
        description: 'Copie a chave agora. Ela nao sera exibida novamente.'
      })

      await loadApiKeys()
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao criar API key',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(row: ApiKeyRow) {
    setUpdatingIds((prev) => ({ ...prev, [row.id]: true }))
    try {
      const response = await fetch('/api/admin/api-keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          is_active: !row.is_active
        })
      })

      const payload = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Falha ao atualizar API key')
      }

      toast({
        title: row.is_active ? 'Chave desativada' : 'Chave ativada',
        description: `${row.name} foi atualizada com sucesso`
      })

      await loadApiKeys()
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao atualizar API key',
        variant: 'destructive'
      })
    } finally {
      setUpdatingIds((prev) => ({ ...prev, [row.id]: false }))
    }
  }

  async function handleCopyGeneratedKey() {
    if (!generatedKey) return
    try {
      await navigator.clipboard.writeText(generatedKey)
      setCopied(true)
      toast({
        title: 'Copiado',
        description: 'API key copiada para a area de transferencia'
      })
    } catch {
      toast({
        title: 'Erro',
        description: 'Nao foi possivel copiar automaticamente. Copie manualmente.',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere chaves `sk_...` para integrar IA com a API v1. A chave completa aparece somente na criacao.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadApiKeys()} disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Gerar Nova Chave
          </CardTitle>
          <CardDescription>
            Associe a chave a uma organizacao. A IA podera acessar apenas os clientes daquela organizacao.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Organizacao</Label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nome da chave</Label>
              <Input
                value={keyName}
                onChange={(event) => setKeyName(event.target.value)}
                placeholder="Ex: OpenClaw Producao"
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label>Expira em (opcional)</Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="perm_full"
                checked={fullAccess}
                onCheckedChange={(checked) => setFullAccess(checked === true)}
              />
              <Label htmlFor="perm_full">Permissao total (*)</Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="perm_balance"
                  checked={permBalanceRead}
                  disabled={fullAccess}
                  onCheckedChange={(checked) => setPermBalanceRead(checked === true)}
                />
                <Label htmlFor="perm_balance">balance:read</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="perm_campaigns_read"
                  checked={permCampaignsRead}
                  disabled={fullAccess}
                  onCheckedChange={(checked) => setPermCampaignsRead(checked === true)}
                />
                <Label htmlFor="perm_campaigns_read">campaigns:read</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="perm_campaigns_write"
                  checked={permCampaignsWrite}
                  disabled={fullAccess}
                  onCheckedChange={(checked) => setPermCampaignsWrite(checked === true)}
                />
                <Label htmlFor="perm_campaigns_write">campaigns:write</Label>
              </div>
            </div>
          </div>

          <Button onClick={() => void handleCreateKey()} disabled={!canCreate}>
            {submitting ? 'Gerando...' : 'Gerar API Key'}
          </Button>
        </CardContent>
      </Card>

      {generatedKey && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <ShieldAlert className="h-5 w-5" />
              Chave Gerada (mostrada uma unica vez)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded bg-muted p-3 font-mono text-sm break-all">{generatedKey}</div>
            <Button variant="outline" onClick={() => void handleCopyGeneratedKey()}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Copiado' : 'Copiar chave'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Chaves cadastradas</CardTitle>
          <CardDescription>{keys.length} chave(s) encontrada(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando...</div>
          ) : keys.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Nenhuma API key cadastrada</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Organizacao</TableHead>
                  <TableHead>Prefixo</TableHead>
                  <TableHead>Permissoes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ultimo uso</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.organization_name ?? row.organization_id}</TableCell>
                    <TableCell>
                      <code>{row.key_prefix}...</code>
                    </TableCell>
                    <TableCell>{formatPermissions(row.permissions)}</TableCell>
                    <TableCell>
                      <Badge variant={row.is_active ? 'default' : 'secondary'}>
                        {row.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(row.last_used_at)}</TableCell>
                    <TableCell>{formatDate(row.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingIds[row.id] === true}
                        onClick={() => void handleToggleActive(row)}
                      >
                        {updatingIds[row.id] === true
                          ? 'Salvando...'
                          : row.is_active
                            ? 'Desativar'
                            : 'Ativar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
