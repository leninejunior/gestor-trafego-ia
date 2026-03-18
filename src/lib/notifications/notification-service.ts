import { createClient } from '@/lib/supabase/server';

export interface NotificationData {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'campaign' | 'sync' | 'billing' | 'system' | 'performance';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

export interface NotificationRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  template: NotificationData;
  isActive: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
  channels: ('in_app' | 'email' | 'webhook')[];
}

export class NotificationService {
  // Criar notificação
  async createNotification(
    userId: string,
    organizationId: string,
    data: NotificationData
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const supabase = await createClient();
      const { data: notification, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          organization_id: organizationId,
          title: data.title,
          message: data.message,
          type: data.type,
          category: data.category,
          priority: data.priority,
          action_url: data.actionUrl,
          action_label: data.actionLabel,
          metadata: data.metadata,
          is_read: false,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;
      return { success: true, id: notification.id };
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  // Buscar notificações do usuário
  async getUserNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      category?: string;
      priority?: string;
    } = {}
  ): Promise<any[]> {
    try {
      const supabase = await createClient();
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (options.unreadOnly) query = query.eq('is_read', false);
      if (options.category) query = query.eq('category', options.category);
      if (options.priority) query = query.eq('priority', options.priority);
      if (options.limit) {
        const offset = options.offset || 0;
        query = query.range(offset, offset + options.limit - 1);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      return [];
    }
  }

  // Marcar notificação como lida
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', userId);

      return !error;
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      return false;
    }
  }

  // Marcar todas as notificações como lidas
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      return !error;
    } catch (error) {
      console.error('Erro ao marcar todas as notificações como lidas:', error);
      return false;
    }
  }

  // Deletar notificação
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      return !error;
    } catch (error) {
      console.error('Erro ao deletar notificação:', error);
      return false;
    }
  }

  // Contar notificações não lidas
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const supabase = await createClient();
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Erro ao contar notificações não lidas:', error);
      return 0;
    }
  }

  // Notificações automáticas baseadas em regras
  async checkAndCreateAutomaticNotifications(): Promise<void> {
    try {
      console.log('🔔 Verificando regras de notificação automática...');
      const supabase = await createClient();
      const { data: rules } = await supabase
        .from('notification_rules')
        .select('*')
        .eq('is_active', true);

      if (!rules || rules.length === 0) return;

      for (const rule of rules) {
        await this.processNotificationRule(rule);
      }
    } catch (error) {
      console.error('Erro ao processar notificações automáticas:', error);
    }
  }

  // Processar regra específica de notificação
  private async processNotificationRule(rule: any): Promise<void> {
    try {
      const conditions = await this.evaluateRuleCondition(rule.condition);

      for (const condition of conditions) {
        const notification: NotificationData = {
          ...rule.template,
          title: this.interpolateTemplate(rule.template.title, condition.data),
          message: this.interpolateTemplate(rule.template.message, condition.data),
          metadata: {
            ...rule.template.metadata,
            ruleId: rule.id,
            conditionData: condition.data
          }
        };

        await this.createNotification(
          condition.userId,
          condition.organizationId,
          notification
        );
      }
    } catch (error) {
      console.error(`Erro ao processar regra ${rule.id}:`, error);
    }
  }

  // Avaliar condição da regra
  private async evaluateRuleCondition(condition: string): Promise<Array<{
    userId: string;
    organizationId: string;
    data: Record<string, any>;
  }>> {
    const results = [];

    try {
      const supabase = await createClient();
      
      if (condition.includes('campaign_performance_drop')) {
        const { data: campaigns } = await supabase
          .from('meta_insights')
          .select(`
            *,
            meta_campaigns (
              name,
              connection_id,
              client_meta_connections (
                created_by,
                clients (
                  organization_id
                )
              )
            )
          `)
          .gte('date_start', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .lt('ctr', 1.0);

        for (const campaign of campaigns || []) {
          if (campaign.meta_campaigns?.client_meta_connections) {
            results.push({
              userId: campaign.meta_campaigns.client_meta_connections.created_by,
              organizationId: campaign.meta_campaigns.client_meta_connections.clients.organization_id,
              data: {
                campaignName: campaign.meta_campaigns.name,
                ctr: campaign.ctr,
                spend: campaign.spend
              }
            });
          }
        }
      }

      if (condition.includes('high_spend_alert')) {
        const { data: highSpend } = await supabase
          .from('meta_insights')
          .select(`
            *,
            meta_campaigns (
              name,
              connection_id,
              client_meta_connections (
                created_by,
                clients (
                  organization_id
                )
              )
            )
          `)
          .gte('date_start', new Date().toISOString().split('T')[0])
          .gt('spend', 1000);

        for (const insight of highSpend || []) {
          if (insight.meta_campaigns?.client_meta_connections) {
            results.push({
              userId: insight.meta_campaigns.client_meta_connections.created_by,
              organizationId: insight.meta_campaigns.client_meta_connections.clients.organization_id,
              data: {
                campaignName: insight.meta_campaigns.name,
                spend: insight.spend,
                date: insight.date_start
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Erro ao avaliar condição:', error);
    }

    return results;
  }

  // Interpolar template com dados
  private interpolateTemplate(template: string, data: Record<string, any>): string {
    let result = template;
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    });
    return result;
  }

  // Criar regras de notificação padrão
  async createDefaultNotificationRules(organizationId: string): Promise<void> {
    const supabase = await createClient();
    const defaultRules: Partial<NotificationRule>[] = [
      {
        name: 'Queda de Performance',
        description: 'Notifica quando CTR de campanha fica abaixo de 1%',
        condition: 'campaign_performance_drop',
        template: {
          title: 'Alerta: Queda de Performance',
          message: 'A campanha "{{campaignName}}" está com CTR de {{ctr}}%, abaixo do esperado.',
          type: 'warning',
          category: 'performance',
          priority: 'high',
          actionUrl: '/dashboard/analytics/advanced',
          actionLabel: 'Ver Analytics'
        },
        isActive: true,
        frequency: 'daily',
        channels: ['in_app', 'email']
      },
      {
        name: 'Gasto Alto',
        description: 'Notifica quando gasto diário ultrapassa R$ 1000',
        condition: 'high_spend_alert',
        template: {
          title: 'Alerta: Gasto Alto Detectado',
          message: 'A campanha "{{campaignName}}" gastou R$ {{spend}} hoje.',
          type: 'warning',
          category: 'campaign',
          priority: 'high',
          actionUrl: '/dashboard/meta',
          actionLabel: 'Ver Campanhas'
        },
        isActive: true,
        frequency: 'immediate',
        channels: ['in_app', 'email']
      },
      {
        name: 'Sincronização Falhada',
        description: 'Notifica quando sincronização com Meta Ads falha',
        condition: 'sync_failed',
        template: {
          title: 'Erro na Sincronização',
          message: 'A sincronização com Meta Ads falhou. Verifique sua conexão.',
          type: 'error',
          category: 'sync',
          priority: 'medium',
          actionUrl: '/dashboard/meta',
          actionLabel: 'Verificar Conexão'
        },
        isActive: true,
        frequency: 'immediate',
        channels: ['in_app']
      }
    ];

    try {
      for (const rule of defaultRules) {
        await supabase
          .from('notification_rules')
          .insert({
            ...rule,
            organization_id: organizationId,
            template: JSON.stringify(rule.template)
          });
      }
      console.log('✅ Regras de notificação padrão criadas');
    } catch (error) {
      console.error('Erro ao criar regras padrão:', error);
    }
  }
}

// Instância singleton
export const notificationService = new NotificationService();
