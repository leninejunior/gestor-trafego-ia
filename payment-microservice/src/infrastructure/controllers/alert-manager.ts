import { Logger } from '../logging/logger';

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  source: string;
  sourceType: 'provider' | 'system' | 'payment' | 'webhook';
  organizationId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  note?: string;
}

export interface AlertFilters {
  status?: 'active' | 'acknowledged' | 'resolved';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  source?: string;
  sourceType?: 'provider' | 'system' | 'payment' | 'webhook';
  organizationId?: string;
  startDate?: Date;
  endDate?: Date;
}

export class AlertManager {
  private logger = Logger.getInstance();
  private alerts: Map<string, Alert> = new Map();

  /**
   * Get alerts with optional filtering
   */
  async getAlerts(filters: AlertFilters = {}, limit: number = 50): Promise<Alert[]> {
    try {
      let filteredAlerts = Array.from(this.alerts.values());

      // Apply filters
      if (filters.status) {
        filteredAlerts = filteredAlerts.filter(alert => alert.status === filters.status);
      }

      if (filters.severity) {
        filteredAlerts = filteredAlerts.filter(alert => alert.severity === filters.severity);
      }

      if (filters.organizationId) {
        filteredAlerts = filteredAlerts.filter(alert => alert.organizationId === filters.organizationId);
      }

      // Sort by creation date (newest first)
      filteredAlerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Apply limit
      return filteredAlerts.slice(0, limit);

    } catch (error) {
      this.logger.error('Failed to get alerts', {
        error: error instanceof Error ? error.message : error,
        filters
      });
      throw error;
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(id: string, userId: string, note?: string): Promise<void> {
    try {
      const alert = this.alerts.get(id);
      
      if (!alert) {
        throw new Error('Alert not found');
      }

      if (alert.status !== 'active') {
        throw new Error('Only active alerts can be acknowledged');
      }

      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = userId;
      alert.updatedAt = new Date();
      
      if (note) {
        alert.note = note;
      }

      this.alerts.set(id, alert);

      this.logger.info('Alert acknowledged', {
        alertId: id,
        userId,
        note
      });

    } catch (error) {
      this.logger.error('Failed to acknowledge alert', {
        error: error instanceof Error ? error.message : error,
        alertId: id,
        userId
      });
      throw error;
    }
  }

  /**
   * Create a new alert (for testing purposes)
   */
  async createAlert(alertData: Omit<Alert, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Alert> {
    const alert: Alert = {
      ...alertData,
      id: this.generateAlertId(),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.alerts.set(alert.id, alert);
    return alert;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}