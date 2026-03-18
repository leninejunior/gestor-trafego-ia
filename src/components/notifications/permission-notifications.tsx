'use client'

import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { 
  Shield, 
  ShieldCheck, 
  ShieldX, 
  Users, 
  Building, 
  Crown,
  Bell,
  X,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserType } from '@/lib/services/user-access-control'

export interface PermissionNotification {
  id: string
  type: 'permission_granted' | 'permission_revoked' | 'user_type_changed' | 'client_access_granted' | 'client_access_revoked' | 'plan_upgraded' | 'subscription_expired'
  title: string
  message: string
  details?: {
    userType?: UserType
    previousUserType?: UserType
    clientName?: string
    clientId?: string
    permission?: string
    planName?: string
  }
  timestamp: Date
  read: boolean
  priority: 'low' | 'medium' | 'high'
  actions?: Array<{
    label: string
    action: () => void
    variant?: 'default' | 'outline' | 'destructive'
  }>
}

interface PermissionNotificationContextType {
  notifications: PermissionNotification[]
  addNotification: (notification: Omit<PermissionNotification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  removeNotification: (id: string) => void
  clearAll: () => void
  unreadCount: number
}

const PermissionNotificationContext = createContext<PermissionNotificationContextType | null>(null)

export function PermissionNotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<PermissionNotification[]>([])

  const addNotification = (notification: Omit<PermissionNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: PermissionNotification = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false
    }

    setNotifications(prev => [newNotification, ...prev])

    // Auto-remove low priority notifications after 10 seconds
    if (notification.priority === 'low') {
      setTimeout(() => {
        removeNotification(newNotification.id)
      }, 10000)
    }
  }

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true }
          : notification
      )
    )
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <PermissionNotificationContext.Provider value={{
      notifications,
      addNotification,
      markAsRead,
      removeNotification,
      clearAll,
      unreadCount
    }}>
      {children}
    </PermissionNotificationContext.Provider>
  )
}

export function usePermissionNotifications() {
  const context = useContext(PermissionNotificationContext)
  if (!context) {
    throw new Error('usePermissionNotifications must be used within a PermissionNotificationProvider')
  }
  return context
}

const notificationIcons = {
  permission_granted: ShieldCheck,
  permission_revoked: ShieldX,
  user_type_changed: Crown,
  client_access_granted: Building,
  client_access_revoked: Building,
  plan_upgraded: CheckCircle,
  subscription_expired: AlertCircle
}

const notificationColors = {
  permission_granted: 'text-green-600',
  permission_revoked: 'text-red-600',
  user_type_changed: 'text-blue-600',
  client_access_granted: 'text-green-600',
  client_access_revoked: 'text-red-600',
  plan_upgraded: 'text-green-600',
  subscription_expired: 'text-red-600'
}

const priorityColors = {
  low: 'border-gray-200',
  medium: 'border-yellow-200',
  high: 'border-red-200'
}

export function PermissionNotificationItem({ 
  notification, 
  onMarkAsRead, 
  onRemove 
}: { 
  notification: PermissionNotification
  onMarkAsRead: (id: string) => void
  onRemove: (id: string) => void
}) {
  const NotificationIcon = notificationIcons[notification.type] || Info
  const iconColor = notificationColors[notification.type] || 'text-gray-600'
  const borderColor = priorityColors[notification.priority]

  const handleMarkAsRead = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id)
    }
  }

  const handleRemove = () => {
    onRemove(notification.id)
  }

  return (
    <Card className={`${borderColor} ${!notification.read ? 'bg-blue-50/50' : 'bg-white'}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full bg-white shadow-sm`}>
            <NotificationIcon className={`h-4 w-4 ${iconColor}`} />
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-medium">{notification.title}</h4>
                <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
              </div>
              
              <div className="flex items-center gap-2">
                {!notification.read && (
                  <Badge variant="secondary" className="text-xs">
                    Novo
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRemove}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Details */}
            {notification.details && (
              <div className="text-xs text-gray-500 space-y-1">
                {notification.details.userType && (
                  <div>Tipo de usuário: {notification.details.userType}</div>
                )}
                {notification.details.previousUserType && (
                  <div>Tipo anterior: {notification.details.previousUserType}</div>
                )}
                {notification.details.clientName && (
                  <div>Cliente: {notification.details.clientName}</div>
                )}
                {notification.details.permission && (
                  <div>Permissão: {notification.details.permission}</div>
                )}
                {notification.details.planName && (
                  <div>Plano: {notification.details.planName}</div>
                )}
              </div>
            )}

            {/* Actions */}
            {notification.actions && notification.actions.length > 0 && (
              <div className="flex gap-2 pt-2">
                {notification.actions.map((action, index) => (
                  <Button
                    key={index}
                    size="sm"
                    variant={action.variant || 'outline'}
                    onClick={() => {
                      action.action()
                      handleMarkAsRead()
                    }}
                    className="text-xs"
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs text-gray-400">
              {notification.timestamp.toLocaleString('pt-BR')}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PermissionNotificationList({ className }: { className?: string }) {
  const { notifications, markAsRead, removeNotification, clearAll } = usePermissionNotifications()

  if (notifications.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">Nenhuma notificação</p>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Notificações de Permissão</h3>
        {notifications.length > 0 && (
          <Button size="sm" variant="outline" onClick={clearAll}>
            Limpar Todas
          </Button>
        )}
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {notifications.map(notification => (
          <PermissionNotificationItem
            key={notification.id}
            notification={notification}
            onMarkAsRead={markAsRead}
            onRemove={removeNotification}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Hook para criar notificações específicas de permissão
 */
export function usePermissionNotificationHelpers() {
  const { addNotification } = usePermissionNotifications()

  const notifyPermissionGranted = (permission: string, details?: any) => {
    addNotification({
      type: 'permission_granted',
      title: 'Permissão Concedida',
      message: `Você recebeu a permissão: ${permission}`,
      details: { permission, ...details },
      priority: 'medium'
    })
  }

  const notifyPermissionRevoked = (permission: string, details?: any) => {
    addNotification({
      type: 'permission_revoked',
      title: 'Permissão Revogada',
      message: `Sua permissão foi removida: ${permission}`,
      details: { permission, ...details },
      priority: 'high'
    })
  }

  const notifyUserTypeChanged = (newType: UserType, previousType: UserType) => {
    addNotification({
      type: 'user_type_changed',
      title: 'Tipo de Usuário Alterado',
      message: `Seu tipo de usuário foi alterado para ${newType}`,
      details: { userType: newType, previousUserType: previousType },
      priority: 'high',
      actions: [
        {
          label: 'Ver Permissões',
          action: () => window.location.href = '/dashboard/profile/permissions'
        }
      ]
    })
  }

  const notifyClientAccessGranted = (clientName: string, clientId: string) => {
    addNotification({
      type: 'client_access_granted',
      title: 'Acesso ao Cliente Concedido',
      message: `Você agora tem acesso ao cliente: ${clientName}`,
      details: { clientName, clientId },
      priority: 'medium',
      actions: [
        {
          label: 'Acessar Cliente',
          action: () => window.location.href = `/dashboard/clients/${clientId}`
        }
      ]
    })
  }

  const notifyClientAccessRevoked = (clientName: string, clientId: string) => {
    addNotification({
      type: 'client_access_revoked',
      title: 'Acesso ao Cliente Removido',
      message: `Seu acesso ao cliente ${clientName} foi removido`,
      details: { clientName, clientId },
      priority: 'high'
    })
  }

  const notifyPlanUpgraded = (planName: string) => {
    addNotification({
      type: 'plan_upgraded',
      title: 'Plano Atualizado',
      message: `Seu plano foi atualizado para: ${planName}`,
      details: { planName },
      priority: 'medium',
      actions: [
        {
          label: 'Ver Benefícios',
          action: () => window.location.href = '/dashboard/billing'
        }
      ]
    })
  }

  const notifySubscriptionExpired = () => {
    addNotification({
      type: 'subscription_expired',
      title: 'Assinatura Expirada',
      message: 'Sua assinatura expirou. Algumas funcionalidades podem estar limitadas.',
      priority: 'high',
      actions: [
        {
          label: 'Renovar Agora',
          action: () => window.location.href = '/dashboard/billing/renew',
          variant: 'default' as const
        }
      ]
    })
  }

  return {
    notifyPermissionGranted,
    notifyPermissionRevoked,
    notifyUserTypeChanged,
    notifyClientAccessGranted,
    notifyClientAccessRevoked,
    notifyPlanUpgraded,
    notifySubscriptionExpired
  }
}

/**
 * Componente de badge para mostrar contagem de notificações não lidas
 */
export function PermissionNotificationBadge({ className }: { className?: string }) {
  const { unreadCount } = usePermissionNotifications()

  if (unreadCount === 0) return null

  return (
    <Badge variant="destructive" className={`text-xs ${className}`}>
      {unreadCount > 99 ? '99+' : unreadCount}
    </Badge>
  )
}