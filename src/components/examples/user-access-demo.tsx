'use client'

import { useUserType, useClientAccess, usePlanLimits, useAccessControlCache } from '@/hooks/use-user-access'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { RefreshCw, Crown, Shield, Users, Building2, Zap, Link as LinkIcon } from 'lucide-react'

/**
 * Demo component showcasing the new user access control hooks
 * This demonstrates how to use the individual hooks instead of the monolithic useUserAccessNew
 */
export function UserAccessDemo() {
  // Individual hooks for specific functionality
  const { userType, loading: userTypeLoading, error: userTypeError, isSuperAdmin, isOrgAdmin, isCommonUser, refresh: refreshUserType } = useUserType()
  const { accessibleClients, loading: clientAccessLoading, error: clientAccessError, checkClientAccess, refresh: refreshClientAccess } = useClientAccess()
  const { 
    planLimits, 
    hasActiveSubscription, 
    canCreateUsers, 
    canCreateClients, 
    canCreateConnections, 
    canCreateCampaigns,
    loading: planLimitsLoading,
    error: planLimitsError,
    refresh: refreshPlanLimits
  } = usePlanLimits()
  
  // Cache management hook
  const { invalidateAll, invalidateUser, invalidateUserType, invalidateClientAccess, invalidatePlanLimits } = useAccessControlCache()

  const loading = userTypeLoading || clientAccessLoading || planLimitsLoading
  const error = userTypeError || clientAccessError || planLimitsError

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Carregando informações de acesso...
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Erro ao carregar informações</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => {
            refreshUserType()
            refreshClientAccess()
            refreshPlanLimits()
          }}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Demonstração dos Hooks de Controle de Acesso</CardTitle>
          <CardDescription>
            Esta demonstração mostra como usar os novos hooks individuais para controle de acesso
          </CardDescription>
        </CardHeader>
      </Card>

      {/* User Type Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isSuperAdmin && <Crown className="h-5 w-5 text-yellow-600" />}
            {isOrgAdmin && <Shield className="h-5 w-5 text-blue-600" />}
            {isCommonUser && <Users className="h-5 w-5 text-gray-600" />}
            Tipo de Usuário
          </CardTitle>
          <CardDescription>
            Informações obtidas via <code>useUserType()</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={isSuperAdmin ? "default" : isOrgAdmin ? "secondary" : "outline"}>
              {userType}
            </Badge>
            {isSuperAdmin && <Badge variant="outline">Acesso Total</Badge>}
            {isOrgAdmin && <Badge variant="outline">Admin da Org</Badge>}
            {isCommonUser && <Badge variant="outline">Usuário Comum</Badge>}
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Super Admin:</strong> {isSuperAdmin ? '✅' : '❌'}
            </div>
            <div>
              <strong>Org Admin:</strong> {isOrgAdmin ? '✅' : '❌'}
            </div>
            <div>
              <strong>Usuário Comum:</strong> {isCommonUser ? '✅' : '❌'}
            </div>
          </div>

          <Button size="sm" variant="outline" onClick={refreshUserType}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar Tipo
          </Button>
        </CardContent>
      </Card>

      {/* Client Access Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Acesso a Clientes
          </CardTitle>
          <CardDescription>
            Informações obtidas via <code>useClientAccess()</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <strong>Clientes Acessíveis:</strong> {accessibleClients.length}
          </div>
          
          {accessibleClients.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Lista de Clientes:</h4>
              <div className="grid gap-2">
                {accessibleClients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between p-2 border rounded">
                    <span>{client.name}</span>
                    <Badge variant="outline">{client.id.slice(0, 8)}...</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button size="sm" variant="outline" onClick={refreshClientAccess}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar Clientes
          </Button>
        </CardContent>
      </Card>

      {/* Plan Limits Information */}
      {!isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Limites do Plano
            </CardTitle>
            <CardDescription>
              Informações obtidas via <code>usePlanLimits()</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={hasActiveSubscription ? "default" : "destructive"}>
                {hasActiveSubscription ? 'Assinatura Ativa' : 'Assinatura Inativa'}
              </Badge>
            </div>

            {planLimits && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Limites:</h4>
                  <div className="text-sm space-y-1">
                    <div>Usuários: {planLimits.maxUsers || '∞'}</div>
                    <div>Clientes: {planLimits.maxClients || '∞'}</div>
                    <div>Conexões: {planLimits.maxConnections || '∞'}</div>
                    <div>Campanhas: {planLimits.maxCampaigns || '∞'}</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Uso Atual:</h4>
                  <div className="text-sm space-y-1">
                    <div>Usuários: {planLimits.currentUsage.users}</div>
                    <div>Clientes: {planLimits.currentUsage.clients}</div>
                    <div>Conexões: {planLimits.currentUsage.connections}</div>
                    <div>Campanhas: {planLimits.currentUsage.campaigns}</div>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <h4 className="font-medium">Permissões de Criação:</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Criar Usuários: {canCreateUsers ? '✅' : '❌'}</div>
                <div>Criar Clientes: {canCreateClients ? '✅' : '❌'}</div>
                <div>Criar Conexões: {canCreateConnections ? '✅' : '❌'}</div>
                <div>Criar Campanhas: {canCreateCampaigns ? '✅' : '❌'}</div>
              </div>
            </div>

            <Button size="sm" variant="outline" onClick={refreshPlanLimits}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar Limites
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cache Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Gerenciamento de Cache
          </CardTitle>
          <CardDescription>
            Controle do cache via <code>useAccessControlCache()</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={invalidateAll}>
              Limpar Todo Cache
            </Button>
            <Button size="sm" variant="outline" onClick={invalidateUser}>
              Limpar Cache do Usuário
            </Button>
            <Button size="sm" variant="outline" onClick={invalidateUserType}>
              Limpar Tipo de Usuário
            </Button>
            <Button size="sm" variant="outline" onClick={invalidateClientAccess}>
              Limpar Acesso a Clientes
            </Button>
            <Button size="sm" variant="outline" onClick={() => invalidatePlanLimits()}>
              Limpar Limites do Plano
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hook Usage Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Exemplos de Uso</CardTitle>
          <CardDescription>
            Como usar os hooks em seus componentes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Hook Individual para Tipo de Usuário:</h4>
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{`const { userType, isSuperAdmin, isOrgAdmin, isCommonUser } = useUserType()`}
            </pre>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Hook para Acesso a Clientes:</h4>
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{`const { accessibleClients, checkClientAccess } = useClientAccess()`}
            </pre>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Hook para Limites do Plano:</h4>
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{`const { planLimits, canCreateClients, hasActiveSubscription } = usePlanLimits()`}
            </pre>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Hook para Gerenciamento de Cache:</h4>
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{`const { invalidateAll, invalidateUserType } = useAccessControlCache()`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}