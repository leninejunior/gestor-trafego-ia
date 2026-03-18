# Monitoring Setup Guide

This document describes the comprehensive monitoring setup for the Payment Microservice, including metrics collection, logging, alerting, and distributed tracing.

## Overview

The monitoring stack includes:

- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **Alertmanager**: Alert routing and notifications
- **Elasticsearch**: Log storage and indexing
- **Logstash**: Log processing and transformation
- **Kibana**: Log visualization and analysis
- **Jaeger**: Distributed tracing

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Payment Service │───▶│   Prometheus    │───▶│     Grafana     │
│                 │    │                 │    │                 │
│   (Metrics)     │    │   (Collection)  │    │ (Visualization) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │  Alertmanager   │              │
         │              │                 │              │
         │              │ (Notifications) │              │
         │              └─────────────────┘              │
         │                                                │
         ▼                                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Logstash     │───▶│ Elasticsearch   │───▶│     Kibana      │
│                 │    │                 │    │                 │
│ (Log Processing)│    │ (Log Storage)   │    │ (Log Analysis)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲
         │
┌─────────────────┐    ┌─────────────────┐
│ Payment Service │───▶│     Jaeger      │
│                 │    │                 │
│   (Traces)      │    │ (Dist. Tracing) │
└─────────────────┘    └─────────────────┘
```

## Quick Setup

### Prerequisites

- Kubernetes cluster with at least 8GB RAM and 4 CPU cores
- kubectl configured
- Ingress controller (nginx recommended)
- Storage class for persistent volumes

### Installation

1. **Deploy monitoring stack:**
   ```bash
   ./scripts/setup-monitoring.sh monitoring
   ```

2. **Verify deployment:**
   ```bash
   kubectl get pods -n monitoring
   ```

3. **Access services via port-forwarding:**
   ```bash
   # Grafana
   kubectl port-forward svc/grafana 3000:3000 -n monitoring
   
   # Prometheus
   kubectl port-forward svc/prometheus 9090:9090 -n monitoring
   
   # Kibana
   kubectl port-forward svc/kibana 5601:5601 -n monitoring
   
   # Jaeger
   kubectl port-forward svc/jaeger-query 16686:16686 -n monitoring
   ```

## Component Details

### Prometheus

**Purpose**: Metrics collection and alerting

**Configuration**:
- Scrapes metrics from payment microservice every 15s
- Stores data for 30 days
- Includes custom alerting rules

**Key Metrics**:
- `http_requests_total`: HTTP request counter
- `http_request_duration_seconds`: Request latency histogram
- `payment_transactions_total`: Payment transaction counter
- `payment_provider_health_status`: Provider health status
- `container_memory_usage_bytes`: Memory usage
- `container_cpu_usage_seconds_total`: CPU usage

**Access**: http://localhost:9090 (via port-forward)

### Grafana

**Purpose**: Metrics visualization and dashboards

**Configuration**:
- Pre-configured with Prometheus datasource
- Includes payment microservice dashboard
- Admin credentials: admin/admin123

**Dashboards**:
- Payment Microservice Overview
- Provider Health Status
- Error Rate Analysis
- Performance Metrics

**Access**: http://localhost:3000 (via port-forward)

### Alertmanager

**Purpose**: Alert routing and notifications

**Configuration**:
- Routes critical alerts to email and PagerDuty
- Routes warnings to Slack
- Includes alert grouping and deduplication

**Alert Channels**:
- Email: oncall@yourdomain.com
- Slack: #alerts, #critical-alerts
- PagerDuty: Integration key required

### Elasticsearch

**Purpose**: Log storage and indexing

**Configuration**:
- Single node deployment (scale for production)
- 50GB storage allocation
- Custom index template for payment logs

**Indices**:
- `payment-microservice-YYYY.MM.DD`: Daily log indices
- `jaeger-*`: Jaeger trace indices

### Logstash

**Purpose**: Log processing and transformation

**Configuration**:
- Processes JSON logs from payment microservice
- Extracts payment provider, transaction ID, errors
- Adds geolocation for client IPs

**Input Sources**:
- Beats (Filebeat from pods)
- HTTP endpoint (port 8080)

### Kibana

**Purpose**: Log visualization and analysis

**Configuration**:
- Connected to Elasticsearch
- Index patterns for payment logs
- Pre-built visualizations

**Access**: http://localhost:5601 (via port-forward)

### Jaeger

**Purpose**: Distributed tracing

**Configuration**:
- Collector receives traces via HTTP/gRPC
- Agent deployed as DaemonSet
- Traces stored in Elasticsearch

**Components**:
- Jaeger Agent: Trace collection
- Jaeger Collector: Trace processing
- Jaeger Query: Trace visualization

**Access**: http://localhost:16686 (via port-forward)

## Alerting Rules

### Critical Alerts

1. **PaymentServiceDown**
   - Condition: Service unavailable for >1 minute
   - Action: Email + PagerDuty + Slack

2. **PaymentProviderDown**
   - Condition: Provider unhealthy for >2 minutes
   - Action: Email + PagerDuty + Slack

### Warning Alerts

1. **PaymentServiceHighErrorRate**
   - Condition: 5xx error rate >10% for >2 minutes
   - Action: Slack notification

2. **PaymentServiceHighLatency**
   - Condition: 95th percentile latency >1s for >5 minutes
   - Action: Slack notification

3. **PaymentFailureRateHigh**
   - Condition: Payment failure rate >5% for >3 minutes
   - Action: Slack notification

4. **PaymentServiceHighMemoryUsage**
   - Condition: Memory usage >90% for >5 minutes
   - Action: Slack notification

5. **PaymentServiceHighCPUUsage**
   - Condition: CPU usage >80% for >5 minutes
   - Action: Slack notification

## Log Analysis

### Log Structure

Payment microservice logs are structured JSON with the following fields:

```json
{
  "@timestamp": "2023-10-01T12:00:00.000Z",
  "level": "info",
  "message": "Payment processed successfully",
  "service": "payment-microservice",
  "environment": "production",
  "transactionId": "txn_123456789",
  "provider": "stripe",
  "amount": 100.00,
  "currency": "USD",
  "clientIp": "192.168.1.100",
  "userId": "user_123",
  "organizationId": "org_456"
}
```

### Common Queries

1. **Error Analysis**:
   ```
   level:error AND service:payment-microservice
   ```

2. **Provider Performance**:
   ```
   provider:stripe AND @timestamp:[now-1h TO now]
   ```

3. **Failed Transactions**:
   ```
   message:"payment failed" AND @timestamp:[now-24h TO now]
   ```

4. **High-Value Transactions**:
   ```
   amount:>1000 AND service:payment-microservice
   ```

## Distributed Tracing

### Trace Structure

Traces include the following spans:

1. **HTTP Request**: Incoming API request
2. **Payment Processing**: Business logic execution
3. **Provider Call**: External provider API call
4. **Database Operation**: Transaction persistence
5. **Webhook Delivery**: Outbound webhook call

### Trace Analysis

Use Jaeger UI to:

1. **Find slow requests**: Filter by duration >1s
2. **Analyze errors**: Filter by error=true tag
3. **Provider comparison**: Compare spans by provider
4. **Dependency mapping**: View service dependencies

## Performance Tuning

### Prometheus

- **Retention**: Adjust `--storage.tsdb.retention.time` based on needs
- **Scrape interval**: Balance between accuracy and load
- **Memory**: Allocate 2GB per million samples per day

### Elasticsearch

- **Shards**: Use 1 shard per index for small deployments
- **Replicas**: Set to 0 for single-node deployments
- **Memory**: Allocate 50% of available RAM to JVM heap

### Logstash

- **Workers**: Set to number of CPU cores
- **Batch size**: Increase for higher throughput
- **Memory**: Allocate 1-2GB JVM heap

## Troubleshooting

### Common Issues

1. **Prometheus not scraping metrics**:
   - Check service discovery configuration
   - Verify network policies allow access
   - Ensure metrics endpoint is accessible

2. **Elasticsearch out of disk space**:
   - Implement index lifecycle management
   - Reduce retention period
   - Add more storage

3. **Grafana dashboards not loading**:
   - Check Prometheus datasource connection
   - Verify query syntax
   - Check time range settings

4. **Alerts not firing**:
   - Verify alerting rules syntax
   - Check Alertmanager configuration
   - Test notification channels

### Debug Commands

```bash
# Check Prometheus targets
kubectl port-forward svc/prometheus 9090:9090 -n monitoring
# Visit http://localhost:9090/targets

# Check Elasticsearch indices
kubectl exec -it elasticsearch-0 -n monitoring -- curl -X GET "localhost:9200/_cat/indices?v"

# Check Logstash pipeline
kubectl logs -f deployment/logstash -n monitoring

# Check Jaeger traces
kubectl port-forward svc/jaeger-query 16686:16686 -n monitoring
# Visit http://localhost:16686
```

## Security Considerations

### Access Control

- **Basic Authentication**: Enabled for all monitoring UIs
- **Network Policies**: Restrict access between components
- **RBAC**: Limit Prometheus service account permissions

### Data Protection

- **Encryption**: Enable TLS for all communications
- **Secrets**: Store sensitive data in Kubernetes secrets
- **Audit Logging**: Enable audit logs for access tracking

### Compliance

- **Data Retention**: Configure appropriate retention periods
- **Data Masking**: Mask sensitive data in logs
- **Access Logs**: Monitor access to monitoring systems

## Maintenance

### Regular Tasks

1. **Weekly**:
   - Review alert noise and tune thresholds
   - Check disk usage and clean old data
   - Update dashboards based on feedback

2. **Monthly**:
   - Review and update alerting rules
   - Analyze performance trends
   - Update monitoring stack versions

3. **Quarterly**:
   - Conduct monitoring system health check
   - Review and optimize resource allocation
   - Update documentation and runbooks

### Backup and Recovery

1. **Prometheus**:
   - Backup configuration and rules
   - Consider federation for HA

2. **Elasticsearch**:
   - Implement snapshot repository
   - Regular automated backups

3. **Grafana**:
   - Export dashboards and datasources
   - Backup configuration database

## Cost Optimization

### Resource Management

1. **Right-sizing**: Monitor actual resource usage
2. **Storage optimization**: Implement data lifecycle policies
3. **Scaling**: Use HPA for dynamic scaling

### Data Retention

1. **Metrics**: 30 days for detailed metrics, 1 year for aggregated
2. **Logs**: 7 days for debug logs, 30 days for audit logs
3. **Traces**: 7 days for all traces

## Integration with CI/CD

The monitoring stack integrates with the CI/CD pipeline:

1. **Health Checks**: Deployment waits for health check success
2. **Smoke Tests**: Automated tests verify monitoring endpoints
3. **Alert Testing**: CI validates alert rule syntax
4. **Dashboard Updates**: Automated dashboard deployment

## Support and Documentation

- **Runbooks**: Located in `docs/runbooks/`
- **Alert Playbooks**: Response procedures for each alert
- **Escalation**: Contact information and escalation paths
- **Training**: Monitoring system training materials