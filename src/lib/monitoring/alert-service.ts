/**
 * Serviço de Alertas
 * Gerencia alertas do sistema e notificações
 */

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  enabled: boolean;
}

export class AlertService {
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];

  constructor() {
    // Initialize with default rules
    this.initializeDefaultRules();
  }

  private initializeDefaultRules() {
    this.rules = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        condition: 'error_rate > threshold',
        threshold: 5,
        enabled: true
      },
      {
        id: 'low-conversion-rate',
        name: 'Low Conversion Rate',
        condition: 'conversion_rate < threshold',
        threshold: 10,
        enabled: true
      }
    ];
  }

  createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): Alert {
    const newAlert: Alert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(newAlert);
    return newAlert;
  }

  getAlerts(filters?: { type?: string; resolved?: boolean }): Alert[] {
    let filteredAlerts = [...this.alerts];

    if (filters?.type) {
      filteredAlerts = filteredAlerts.filter(alert => alert.type === filters.type);
    }

    if (filters?.resolved !== undefined) {
      filteredAlerts = filteredAlerts.filter(alert => alert.resolved === filters.resolved);
    }

    return filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  checkRules(metrics: Record<string, number>): Alert[] {
    const triggeredAlerts: Alert[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      // Simple rule evaluation
      if (rule.condition.includes('error_rate > threshold') && metrics.error_rate > rule.threshold) {
        triggeredAlerts.push(this.createAlert({
          type: 'error',
          title: 'High Error Rate Detected',
          message: `Error rate (${metrics.error_rate}%) exceeds threshold (${rule.threshold}%)`,
          metadata: { rule_id: rule.id, metric_value: metrics.error_rate }
        }));
      }

      if (rule.condition.includes('conversion_rate < threshold') && metrics.conversion_rate < rule.threshold) {
        triggeredAlerts.push(this.createAlert({
          type: 'warning',
          title: 'Low Conversion Rate',
          message: `Conversion rate (${metrics.conversion_rate}%) below threshold (${rule.threshold}%)`,
          metadata: { rule_id: rule.id, metric_value: metrics.conversion_rate }
        }));
      }
    }

    return triggeredAlerts;
  }

  getMetrics(): { total: number; unresolved: number; byType: Record<string, number> } {
    const total = this.alerts.length;
    const unresolved = this.alerts.filter(a => !a.resolved).length;
    const byType = this.alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, unresolved, byType };
  }
}

export default AlertService;