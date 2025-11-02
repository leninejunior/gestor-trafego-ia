/**
 * Serviço de Observabilidade
 * Coleta métricas, logs e traces do sistema
 */

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export interface TraceSpan {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'success' | 'error' | 'pending';
  metadata?: Record<string, any>;
}

export class ObservabilityService {
  private metrics: Metric[] = [];
  private logs: LogEntry[] = [];
  private traces: TraceSpan[] = [];
  private maxRetention = 10000; // Maximum entries to keep

  recordMetric(name: string, value: number, labels?: Record<string, string>) {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date(),
      labels
    };

    this.metrics.push(metric);
    this.cleanup('metrics');
  }

  log(level: LogEntry['level'], message: string, context?: Record<string, any>) {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context
    };

    this.logs.push(logEntry);
    this.cleanup('logs');

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console[level === 'debug' ? 'log' : level](message, context);
    }
  }

  startTrace(name: string, metadata?: Record<string, any>): string {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const span: TraceSpan = {
      id: traceId,
      name,
      startTime: new Date(),
      status: 'pending',
      metadata
    };

    this.traces.push(span);
    return traceId;
  }

  endTrace(traceId: string, status: 'success' | 'error' = 'success', metadata?: Record<string, any>) {
    const span = this.traces.find(t => t.id === traceId);
    if (span) {
      span.endTime = new Date();
      span.duration = span.endTime.getTime() - span.startTime.getTime();
      span.status = status;
      if (metadata) {
        span.metadata = { ...span.metadata, ...metadata };
      }
    }
    
    this.cleanup('traces');
  }

  getMetrics(filters?: { 
    name?: string; 
    since?: Date; 
    labels?: Record<string, string> 
  }): Metric[] {
    let filteredMetrics = [...this.metrics];

    if (filters?.name) {
      filteredMetrics = filteredMetrics.filter(m => m.name === filters.name);
    }

    if (filters?.since) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp >= filters.since!);
    }

    if (filters?.labels) {
      filteredMetrics = filteredMetrics.filter(m => {
        if (!m.labels) return false;
        return Object.entries(filters.labels!).every(([key, value]) => 
          m.labels![key] === value
        );
      });
    }

    return filteredMetrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getLogs(filters?: { 
    level?: LogEntry['level']; 
    since?: Date; 
    search?: string 
  }): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filters?.level) {
      filteredLogs = filteredLogs.filter(l => l.level === filters.level);
    }

    if (filters?.since) {
      filteredLogs = filteredLogs.filter(l => l.timestamp >= filters.since!);
    }

    if (filters?.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredLogs = filteredLogs.filter(l => 
        l.message.toLowerCase().includes(searchTerm)
      );
    }

    return filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getTraces(filters?: { 
    name?: string; 
    status?: TraceSpan['status']; 
    since?: Date 
  }): TraceSpan[] {
    let filteredTraces = [...this.traces];

    if (filters?.name) {
      filteredTraces = filteredTraces.filter(t => t.name === filters.name);
    }

    if (filters?.status) {
      filteredTraces = filteredTraces.filter(t => t.status === filters.status);
    }

    if (filters?.since) {
      filteredTraces = filteredTraces.filter(t => t.startTime >= filters.since!);
    }

    return filteredTraces.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  getSystemHealth(): {
    metrics: { total: number; recent: number };
    logs: { total: number; errors: number; warnings: number };
    traces: { total: number; active: number; errors: number };
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    return {
      metrics: {
        total: this.metrics.length,
        recent: this.metrics.filter(m => m.timestamp >= oneHourAgo).length
      },
      logs: {
        total: this.logs.length,
        errors: this.logs.filter(l => l.level === 'error').length,
        warnings: this.logs.filter(l => l.level === 'warn').length
      },
      traces: {
        total: this.traces.length,
        active: this.traces.filter(t => t.status === 'pending').length,
        errors: this.traces.filter(t => t.status === 'error').length
      }
    };
  }

  private cleanup(type: 'metrics' | 'logs' | 'traces') {
    switch (type) {
      case 'metrics':
        if (this.metrics.length > this.maxRetention) {
          this.metrics = this.metrics.slice(-this.maxRetention);
        }
        break;
      case 'logs':
        if (this.logs.length > this.maxRetention) {
          this.logs = this.logs.slice(-this.maxRetention);
        }
        break;
      case 'traces':
        if (this.traces.length > this.maxRetention) {
          this.traces = this.traces.slice(-this.maxRetention);
        }
        break;
    }
  }

  // Utility methods for common operations
  recordApiCall(endpoint: string, method: string, statusCode: number, duration: number) {
    this.recordMetric('api_calls_total', 1, { endpoint, method, status: statusCode.toString() });
    this.recordMetric('api_duration_ms', duration, { endpoint, method });
    
    if (statusCode >= 400) {
      this.log('error', `API call failed: ${method} ${endpoint}`, { statusCode, duration });
    }
  }

  recordDatabaseQuery(query: string, duration: number, success: boolean) {
    this.recordMetric('db_queries_total', 1, { success: success.toString() });
    this.recordMetric('db_query_duration_ms', duration);
    
    if (!success) {
      this.log('error', 'Database query failed', { query, duration });
    }
  }

  recordUserAction(action: string, userId?: string, metadata?: Record<string, any>) {
    this.recordMetric('user_actions_total', 1, { action, user_id: userId || 'anonymous' });
    this.log('info', `User action: ${action}`, { userId, ...metadata });
  }
}

export default ObservabilityService;