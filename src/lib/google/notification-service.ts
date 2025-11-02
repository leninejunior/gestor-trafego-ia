/**
 * Google Ads Notification Service
 * 
 * Handles notifications for Google Ads sync errors, successes, and alerts
 * Requirements: 10.5
 */

import { notificationService, NotificationData } from '@/lib/notifications/notification-service';
import { createClient } from '@/lib/supabase/server';

export interface GoogleAdsSyncNotification {
  connectionId: string;
  clientId: string;
  userId: string;
  organizationId: string;
  syncType: 'campaigns' | 'metrics' | 'full';
  status: 'success' | 'error' | 'partial';
  details?: {
    campaignsSynced?: number;
    metricsUpdated?: number;
    errorMessage?: string;
    duration?: number;
  };
}

export interface GoogleAdsErrorNotification {
  connectionId: string;
  clientId: string;
  userId: string;
  organizationId: string;
  errorType: 'auth' | 'api' | 'sync' | 'connection';
  errorCode?: string;
  errorMessage: string;
  isRetryable: boolean;
  retryCount?: number;
}

export class GoogleAdsNotificationService {
  /**
   * Notify sync completion (success or failure)
   */
  async notifySyncCompletion(notification: GoogleAdsSyncNotification): Promise<void> {
    try {
      let notificationData: NotificationData;

      switch (notification.status) {
        case 'success':
          notificationData = {
            title: 'Sincronização Google Ads Concluída',
            message: this.buildSyncSuccessMessage(notification),
            type: 'success',
            category: 'sync',
            priority: 'low',
            actionUrl: '/dashboard/google',
            actionLabel: 'Ver Campanhas',
            metadata: {
              platform: 'google_ads',
              syncType: notification.syncType,
              connectionId: notification.connectionId,
              clientId: notification.clientId,
              details: notification.details
            }
          };
          break;

        case 'error':
          notificationData = {
            title: 'Erro na Sincronização Google Ads',
            message: this.buildSyncErrorMessage(notification),
            type: 'error',
            category: 'sync',
            priority: 'high',
            actionUrl: '/dashboard/google',
            actionLabel: 'Verificar Conexão',
            metadata: {
              platform: 'google_ads',
              syncType: notification.syncType,
              connectionId: notification.connectionId,
              clientId: notification.clientId,
              details: notification.details
            }
          };
          break;

        case 'partial':
          notificationData = {
            title: 'Sincronização Google Ads Parcial',
            message: this.buildSyncPartialMessage(notification),
            type: 'warning',
            category: 'sync',
            priority: 'medium',
            actionUrl: '/dashboard/google',
            actionLabel: 'Ver Detalhes',
            metadata: {
              platform: 'google_ads',
              syncType: notification.syncType,
              connectionId: notification.connectionId,
              clientId: notification.clientId,
              details: notification.details
            }
          };
          break;
      }

      await notificationService.createNotification(
        notification.userId,
        notification.organizationId,
        notificationData
      );

      // Log notification for debugging
      console.log('[Google Ads Notification] Sync notification sent:', {
        userId: notification.userId,
        status: notification.status,
        syncType: notification.syncType
      });

    } catch (error) {
      console.error('[Google Ads Notification] Error sending sync notification:', error);
    }
  }

  /**
   * Notify API or connection errors
   */
  async notifyError(notification: GoogleAdsErrorNotification): Promise<void> {
    try {
      const notificationData: NotificationData = {
        title: this.getErrorTitle(notification.errorType),
        message: this.buildErrorMessage(notification),
        type: 'error',
        category: notification.errorType === 'sync' ? 'sync' : 'system',
        priority: this.getErrorPriority(notification),
        actionUrl: this.getErrorActionUrl(notification.errorType),
        actionLabel: this.getErrorActionLabel(notification.errorType),
        metadata: {
          platform: 'google_ads',
          errorType: notification.errorType,
          errorCode: notification.errorCode,
          connectionId: notification.connectionId,
          clientId: notification.clientId,
          isRetryable: notification.isRetryable,
          retryCount: notification.retryCount
        }
      };

      await notificationService.createNotification(
        notification.userId,
        notification.organizationId,
        notificationData
      );

      // Log error notification
      console.log('[Google Ads Notification] Error notification sent:', {
        userId: notification.userId,
        errorType: notification.errorType,
        errorCode: notification.errorCode
      });

    } catch (error) {
      console.error('[Google Ads Notification] Error sending error notification:', error);
    }
  }

  /**
   * Notify administrators of critical issues
   */
  async notifyAdministrators(
    organizationId: string,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Get organization administrators
      const supabase = await createClient();
      const { data: admins } = await supabase
        .from('organization_memberships')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('role', 'admin');

      if (!admins || admins.length === 0) {
        console.warn('[Google Ads Notification] No administrators found for organization:', organizationId);
        return;
      }

      const notificationData: NotificationData = {
        title,
        message,
        type: 'error',
        category: 'system',
        priority: 'urgent',
        actionUrl: '/admin/monitoring',
        actionLabel: 'Ver Monitoramento',
        metadata: {
          platform: 'google_ads',
          isAdminAlert: true,
          ...metadata
        }
      };

      // Send notification to all administrators
      for (const admin of admins) {
        await notificationService.createNotification(
          admin.user_id,
          organizationId,
          notificationData
        );
      }

      console.log('[Google Ads Notification] Admin notifications sent:', {
        organizationId,
        adminCount: admins.length,
        title
      });

    } catch (error) {
      console.error('[Google Ads Notification] Error sending admin notifications:', error);
    }
  }

  /**
   * Notify successful actions
   */
  async notifySuccess(
    userId: string,
    organizationId: string,
    action: 'connection' | 'campaign_update' | 'export',
    details?: Record<string, any>
  ): Promise<void> {
    try {
      let notificationData: NotificationData;

      switch (action) {
        case 'connection':
          notificationData = {
            title: 'Google Ads Conectado',
            message: 'Sua conta Google Ads foi conectada com sucesso. A sincronização inicial será executada em breve.',
            type: 'success',
            category: 'system',
            priority: 'low',
            actionUrl: '/dashboard/google',
            actionLabel: 'Ver Dashboard',
            metadata: {
              platform: 'google_ads',
              action,
              ...details
            }
          };
          break;

        case 'campaign_update':
          notificationData = {
            title: 'Campanhas Atualizadas',
            message: `${details?.count || 'Suas'} campanhas Google Ads foram atualizadas com sucesso.`,
            type: 'success',
            category: 'campaign',
            priority: 'low',
            actionUrl: '/dashboard/google',
            actionLabel: 'Ver Campanhas',
            metadata: {
              platform: 'google_ads',
              action,
              ...details
            }
          };
          break;

        case 'export':
          notificationData = {
            title: 'Exportação Concluída',
            message: 'Seus dados Google Ads foram exportados com sucesso.',
            type: 'success',
            category: 'system',
            priority: 'low',
            actionUrl: details?.downloadUrl || '/dashboard/google',
            actionLabel: 'Baixar Arquivo',
            metadata: {
              platform: 'google_ads',
              action,
              ...details
            }
          };
          break;

        default:
          return;
      }

      await notificationService.createNotification(
        userId,
        organizationId,
        notificationData
      );

    } catch (error) {
      console.error('[Google Ads Notification] Error sending success notification:', error);
    }
  }

  /**
   * Build sync success message
   */
  private buildSyncSuccessMessage(notification: GoogleAdsSyncNotification): string {
    const { details, syncType } = notification;
    
    if (syncType === 'full') {
      return `Sincronização completa finalizada. ${details?.campaignsSynced || 0} campanhas e ${details?.metricsUpdated || 0} métricas atualizadas.`;
    }
    
    if (syncType === 'campaigns') {
      return `${details?.campaignsSynced || 0} campanhas sincronizadas com sucesso.`;
    }
    
    if (syncType === 'metrics') {
      return `${details?.metricsUpdated || 0} métricas atualizadas com sucesso.`;
    }

    return 'Sincronização Google Ads concluída com sucesso.';
  }

  /**
   * Build sync error message
   */
  private buildSyncErrorMessage(notification: GoogleAdsSyncNotification): string {
    const { details, syncType } = notification;
    const baseMessage = `Falha na sincronização ${syncType === 'full' ? 'completa' : `de ${syncType}`} do Google Ads.`;
    
    if (details?.errorMessage) {
      return `${baseMessage} Erro: ${details.errorMessage}`;
    }
    
    return `${baseMessage} Verifique sua conexão e tente novamente.`;
  }

  /**
   * Build sync partial message
   */
  private buildSyncPartialMessage(notification: GoogleAdsSyncNotification): string {
    const { details } = notification;
    return `Sincronização parcialmente concluída. ${details?.campaignsSynced || 0} campanhas sincronizadas, mas alguns dados podem estar incompletos.`;
  }

  /**
   * Build error message
   */
  private buildErrorMessage(notification: GoogleAdsErrorNotification): string {
    const { errorType, errorMessage, isRetryable, retryCount } = notification;
    
    let message = errorMessage;
    
    if (errorType === 'auth') {
      message = 'Erro de autenticação com Google Ads. Reconecte sua conta para continuar.';
    } else if (errorType === 'connection') {
      message = 'Falha na conexão com Google Ads. Verifique sua internet e configurações.';
    }
    
    if (isRetryable && retryCount && retryCount > 1) {
      message += ` (Tentativa ${retryCount})`;
    }
    
    return message;
  }

  /**
   * Get error title based on type
   */
  private getErrorTitle(errorType: string): string {
    switch (errorType) {
      case 'auth':
        return 'Erro de Autenticação Google Ads';
      case 'api':
        return 'Erro na API Google Ads';
      case 'sync':
        return 'Erro na Sincronização';
      case 'connection':
        return 'Erro de Conexão Google Ads';
      default:
        return 'Erro Google Ads';
    }
  }

  /**
   * Get error priority
   */
  private getErrorPriority(notification: GoogleAdsErrorNotification): 'low' | 'medium' | 'high' | 'urgent' {
    if (notification.errorType === 'auth') return 'high';
    if (notification.errorType === 'connection') return 'medium';
    if (notification.retryCount && notification.retryCount > 2) return 'high';
    return 'medium';
  }

  /**
   * Get error action URL
   */
  private getErrorActionUrl(errorType: string): string {
    switch (errorType) {
      case 'auth':
      case 'connection':
        return '/dashboard/google';
      case 'sync':
        return '/dashboard/google';
      default:
        return '/dashboard';
    }
  }

  /**
   * Get error action label
   */
  private getErrorActionLabel(errorType: string): string {
    switch (errorType) {
      case 'auth':
        return 'Reconectar Conta';
      case 'connection':
        return 'Verificar Conexão';
      case 'sync':
        return 'Tentar Novamente';
      default:
        return 'Ver Detalhes';
    }
  }
}

// Singleton instance
export const googleAdsNotificationService = new GoogleAdsNotificationService();