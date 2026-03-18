'use client';

import { Badge } from '@/components/ui/badge';
import { Crown, Shield, User, Lock } from 'lucide-react';
import { useUserAccessNew } from '@/hooks/use-user-access-new';
import { UserType } from '@/lib/services/user-access-control';

interface UserTypeIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

export function UserTypeIndicator({ showDetails = false, className }: UserTypeIndicatorProps) {
  const { 
    userType, 
    hasActiveSubscription, 
    planLimits, 
    loading 
  } = useUserAccessNew();

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 w-20 bg-muted rounded"></div>
      </div>
    );
  }

  const getUserTypeConfig = () => {
    switch (userType) {
      case UserType.SUPER_ADMIN:
        return {
          icon: Crown,
          label: 'Super Admin',
          variant: 'destructive' as const,
          color: 'text-purple-600',
          description: 'Acesso total ao sistema'
        };
      case UserType.ORG_ADMIN:
        return {
          icon: Shield,
          label: 'Admin',
          variant: 'default' as const,
          color: 'text-blue-600',
          description: 'Administrador da organização'
        };
      case UserType.COMMON_USER:
        return {
          icon: User,
          label: 'Usuário',
          variant: 'secondary' as const,
          color: 'text-gray-600',
          description: 'Acesso limitado aos clientes autorizados'
        };
      default:
        return {
          icon: User,
          label: 'Usuário',
          variant: 'outline' as const,
          color: 'text-gray-600',
          description: 'Tipo de usuário não definido'
        };
    }
  };

  const config = getUserTypeConfig();
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
      
      {!hasActiveSubscription && userType !== UserType.SUPER_ADMIN && (
        <Badge variant="outline" className="flex items-center gap-1 text-orange-600 border-orange-300">
          <Lock className="h-3 w-3" />
          Plano Expirado
        </Badge>
      )}

      {showDetails && planLimits && (
        <div className="text-xs text-muted-foreground">
          {planLimits.maxClients !== null && (
            <span>
              Clientes: {planLimits.currentUsage.clients}/{planLimits.maxClients}
            </span>
          )}
          {planLimits.maxUsers !== null && (
            <span className="ml-2">
              Usuários: {planLimits.currentUsage.users}/{planLimits.maxUsers}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function UserTypeCard() {
  const { 
    userType, 
    hasActiveSubscription, 
    planLimits, 
    loading 
  } = useUserAccessNew();

  if (loading) {
    return (
      <div className="p-4 border rounded-lg animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-2"></div>
        <div className="h-3 w-32 bg-muted rounded"></div>
      </div>
    );
  }

  const config = (() => {
    switch (userType) {
      case UserType.SUPER_ADMIN:
        return {
          icon: Crown,
          title: 'Super Administrador',
          description: 'Acesso total ao sistema sem limitações',
          color: 'border-purple-200 bg-purple-50',
          iconColor: 'text-purple-600'
        };
      case UserType.ORG_ADMIN:
        return {
          icon: Shield,
          title: 'Administrador da Organização',
          description: 'Gerencia usuários e clientes dentro do plano contratado',
          color: 'border-blue-200 bg-blue-50',
          iconColor: 'text-blue-600'
        };
      case UserType.COMMON_USER:
        return {
          icon: User,
          title: 'Usuário Comum',
          description: 'Acesso restrito aos clientes autorizados pelo administrador',
          color: 'border-gray-200 bg-gray-50',
          iconColor: 'text-gray-600'
        };
      default:
        return {
          icon: User,
          title: 'Usuário',
          description: 'Tipo de usuário não definido',
          color: 'border-gray-200 bg-gray-50',
          iconColor: 'text-gray-600'
        };
    }
  })();

  const Icon = config.icon;

  return (
    <div className={`p-4 border rounded-lg ${config.color}`}>
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`h-5 w-5 ${config.iconColor}`} />
        <h3 className="font-medium">{config.title}</h3>
      </div>
      
      <p className="text-sm text-muted-foreground mb-3">
        {config.description}
      </p>

      {!hasActiveSubscription && userType !== UserType.SUPER_ADMIN && (
        <div className="flex items-center gap-2 p-2 bg-orange-100 border border-orange-200 rounded text-sm text-orange-700">
          <Lock className="h-4 w-4" />
          <span>Plano expirado - Funcionalidades limitadas</span>
        </div>
      )}

      {planLimits && hasActiveSubscription && userType !== UserType.SUPER_ADMIN && (
        <div className="space-y-2 text-sm">
          <div className="font-medium text-muted-foreground">Limites do Plano:</div>
          <div className="grid grid-cols-2 gap-2">
            {planLimits.maxClients !== null && (
              <div>
                <span className="text-muted-foreground">Clientes:</span>
                <span className="ml-1 font-medium">
                  {planLimits.currentUsage.clients}/{planLimits.maxClients}
                </span>
              </div>
            )}
            {planLimits.maxUsers !== null && (
              <div>
                <span className="text-muted-foreground">Usuários:</span>
                <span className="ml-1 font-medium">
                  {planLimits.currentUsage.users}/{planLimits.maxUsers}
                </span>
              </div>
            )}
            {planLimits.maxConnections !== null && (
              <div>
                <span className="text-muted-foreground">Conexões:</span>
                <span className="ml-1 font-medium">
                  {planLimits.currentUsage.connections}/{planLimits.maxConnections}
                </span>
              </div>
            )}
            {planLimits.maxCampaigns !== null && (
              <div>
                <span className="text-muted-foreground">Campanhas:</span>
                <span className="ml-1 font-medium">
                  {planLimits.currentUsage.campaigns}/{planLimits.maxCampaigns}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}