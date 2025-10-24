# Maintenance and Support Procedures

## Overview

This document outlines the maintenance procedures, backup strategies, disaster recovery plans, and support escalation procedures for the Payment Microservice.

## Backup and Recovery Procedures

### Database Backup Strategy

#### Automated Backups

```bash
#!/bin/bash
# Daily backup script - /scripts/backup-database.sh

BACKUP_DIR="/backups/payment-service"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="payment_service"

# Create backup directory
mkdir -p $BACKUP_DIR

# Full database backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > $BACKUP_DIR/full_backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/full_backup_$DATE.sql

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Upload to S3 for offsite storage
aws s3 cp $BACKUP_DIR/full_backup_$DATE.sql.gz s3://payment-service-backups/daily/

echo "Backup completed: full_backup_$DATE.sql.gz"
```

#### Backup Schedule

- **Full Backup**: Daily at 2:00 AM UTC
- **Incremental Backup**: Every 6 hours
- **Transaction Log Backup**: Every 15 minutes
- **Retention**: 30 days local, 1 year in S3

#### Recovery Procedures

##### Point-in-Time Recovery

```bash
#!/bin/bash
# Point-in-time recovery script

RECOVERY_TIME="2024-01-15 14:30:00"
BACKUP_FILE="/backups/payment-service/full_backup_20240115_020000.sql.gz"

# Stop the application
kubectl scale deployment payment-service --replicas=0

# Restore from backup
gunzip -c $BACKUP_FILE | psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Apply transaction logs up to recovery point
pg_waldump --start-time="$RECOVERY_TIME" /var/lib/postgresql/wal | psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Restart the application
kubectl scale deployment payment-service --replicas=3

echo "Recovery completed to $RECOVERY_TIME"
```

##### Full System Recovery

```bash
#!/bin/bash
# Full system recovery from disaster

# 1. Provision new infrastructure
terraform apply -var="environment=disaster-recovery"

# 2. Restore database
./scripts/restore-database.sh

# 3. Deploy application
kubectl apply -f k8s/

# 4. Restore Redis cache
redis-cli --rdb /backups/redis/dump.rdb

# 5. Verify system health
./scripts/health-check.sh

echo "Full system recovery completed"
```

### Application Data Backup

#### Configuration Backup

```yaml
# Kubernetes CronJob for config backup
apiVersion: batch/v1
kind: CronJob
metadata:
  name: config-backup
spec:
  schedule: "0 1 * * *"  # Daily at 1 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: payment-service:latest
            command:
            - /bin/sh
            - -c
            - |
              # Backup provider configurations
              kubectl get configmaps -o yaml > /backups/configmaps.yaml
              kubectl get secrets -o yaml > /backups/secrets.yaml
              
              # Upload to S3
              aws s3 cp /backups/ s3://payment-service-backups/configs/ --recursive
          restartPolicy: OnFailure
```

## Disaster Recovery Plan

### Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO)

| Component | RTO | RPO | Priority |
|-----------|-----|-----|----------|
| Payment Processing | 15 minutes | 5 minutes | Critical |
| Provider Management | 30 minutes | 15 minutes | High |
| Reporting | 2 hours | 1 hour | Medium |
| Admin Dashboard | 4 hours | 4 hours | Low |

### Disaster Scenarios

#### Scenario 1: Database Failure

**Detection:**
- Database health checks fail
- Application cannot connect to database
- High error rates in payment processing

**Response:**
1. Activate read replica as primary (automatic failover)
2. Redirect traffic to backup region if needed
3. Restore from latest backup if corruption detected
4. Notify stakeholders via incident management system

**Recovery Steps:**
```bash
# Automatic failover script
#!/bin/bash
if ! pg_isready -h $PRIMARY_DB_HOST; then
  echo "Primary database down, failing over to replica"
  
  # Promote replica to primary
  kubectl patch postgresql primary --type='merge' -p='{"spec":{"postgresql":{"primary":false}}}'
  kubectl patch postgresql replica --type='merge' -p='{"spec":{"postgresql":{"primary":true}}}'
  
  # Update application config
  kubectl set env deployment/payment-service DATABASE_HOST=$REPLICA_DB_HOST
  
  # Trigger incident alert
  curl -X POST $INCIDENT_WEBHOOK_URL -d '{"severity":"critical","message":"Database failover executed"}'
fi
```

#### Scenario 2: Complete Region Failure

**Detection:**
- All services in primary region unreachable
- Load balancer health checks fail
- Monitoring alerts from multiple systems

**Response:**
1. Activate disaster recovery region
2. Restore data from cross-region backups
3. Update DNS to point to DR region
4. Communicate with customers about service restoration

**Recovery Steps:**
```bash
# Disaster recovery activation
#!/bin/bash
echo "Activating disaster recovery region..."

# Deploy infrastructure in DR region
cd terraform/dr-region
terraform apply -auto-approve

# Restore database from cross-region backup
aws s3 cp s3://payment-service-backups-dr/latest/full_backup.sql.gz /tmp/
gunzip /tmp/full_backup.sql.gz
psql -h $DR_DB_HOST -U $DB_USER -d $DB_NAME -f /tmp/full_backup.sql

# Deploy application
kubectl config use-context dr-region
kubectl apply -f k8s/

# Update DNS
aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID --change-batch file://dns-failover.json

echo "Disaster recovery activation completed"
```

### Communication Plan

#### Stakeholder Notification Matrix

| Incident Severity | Notification Time | Recipients |
|-------------------|-------------------|------------|
| Critical | Immediate | CTO, Engineering Manager, On-call Engineer |
| High | 15 minutes | Engineering Team, Product Manager |
| Medium | 1 hour | Engineering Team |
| Low | 4 hours | Engineering Team (email only) |

#### Communication Templates

```json
{
  "critical_incident": {
    "subject": "CRITICAL: Payment Service Outage - Incident #{incident_id}",
    "body": "We are experiencing a critical outage affecting payment processing. ETA for resolution: {eta}. Updates will be provided every 15 minutes."
  },
  "resolution": {
    "subject": "RESOLVED: Payment Service Incident #{incident_id}",
    "body": "The payment service incident has been resolved. Root cause: {root_cause}. Post-mortem will be conducted within 24 hours."
  }
}
```

## Incident Escalation Procedures

### Escalation Matrix

#### Level 1: On-Call Engineer (0-30 minutes)
- **Responsibilities:**
  - Initial incident response
  - Basic troubleshooting
  - System health assessment
  - Incident documentation

- **Escalation Criteria:**
  - Unable to resolve within 30 minutes
  - Requires database changes
  - Affects multiple providers
  - Customer impact > 100 transactions

#### Level 2: Senior Engineer (30-60 minutes)
- **Responsibilities:**
  - Advanced troubleshooting
  - Code deployment decisions
  - Provider configuration changes
  - Coordination with external teams

- **Escalation Criteria:**
  - Unable to resolve within 60 minutes
  - Requires architectural changes
  - Data integrity concerns
  - Regulatory compliance issues

#### Level 3: Engineering Manager (60+ minutes)
- **Responsibilities:**
  - Resource allocation decisions
  - External vendor coordination
  - Executive communication
  - Post-incident review planning

### Incident Response Playbooks

#### Payment Processing Failure

```yaml
incident_type: payment_processing_failure
severity: critical
response_time: immediate

steps:
  1. Check provider status:
     - Verify Stripe API status
     - Check Iugu service health
     - Validate PagSeguro connectivity
     - Test Mercado Pago endpoints
  
  2. Analyze error patterns:
     - Review error logs for common patterns
     - Check transaction failure rates by provider
     - Identify affected payment methods
  
  3. Implement workarounds:
     - Disable failing providers temporarily
     - Route traffic to healthy providers
     - Enable manual payment processing if needed
  
  4. Monitor and communicate:
     - Update status page
     - Notify affected customers
     - Provide regular updates to stakeholders

escalation_triggers:
  - Failure rate > 10%
  - Multiple providers affected
  - Unable to process payments for > 15 minutes
```

#### Database Performance Issues

```yaml
incident_type: database_performance
severity: high
response_time: 15_minutes

steps:
  1. Identify bottlenecks:
     - Check slow query log
     - Analyze connection pool usage
     - Review index performance
     - Monitor disk I/O
  
  2. Immediate actions:
     - Kill long-running queries
     - Increase connection pool size
     - Enable query caching
     - Scale read replicas if needed
  
  3. Long-term fixes:
     - Optimize problematic queries
     - Add missing indexes
     - Partition large tables
     - Review data retention policies

escalation_triggers:
  - Query response time > 5 seconds
  - Connection pool exhaustion
  - Disk usage > 90%
  - Unable to resolve within 1 hour
```

## Knowledge Base and Troubleshooting

### Common Issues and Solutions

#### Issue: High Payment Failure Rate

**Symptoms:**
- Increased 4xx/5xx error responses
- Provider timeout errors
- Customer complaints about failed payments

**Diagnosis:**
```bash
# Check error rates by provider
kubectl logs deployment/payment-service | grep "payment_failed" | awk '{print $5}' | sort | uniq -c

# Check provider health
curl -H "Authorization: Bearer $API_TOKEN" http://payment-service/api/v2/providers/health

# Analyze recent transactions
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT provider_name, status, COUNT(*) 
  FROM transactions 
  WHERE created_at > NOW() - INTERVAL '1 hour' 
  GROUP BY provider_name, status;
"
```

**Solutions:**
1. Check provider API status pages
2. Verify provider credentials are valid
3. Review rate limiting settings
4. Test with small amounts first
5. Enable failover to backup providers

#### Issue: Memory Leaks

**Symptoms:**
- Gradual increase in memory usage
- Pod restarts due to OOM kills
- Slow response times

**Diagnosis:**
```bash
# Check memory usage trends
kubectl top pods -l app=payment-service

# Generate heap dump
kubectl exec -it payment-service-pod -- node --inspect --heap-prof app.js

# Analyze memory patterns
kubectl logs payment-service-pod | grep "memory"
```

**Solutions:**
1. Review recent code changes
2. Check for unclosed database connections
3. Analyze object retention in heap dumps
4. Implement memory monitoring alerts
5. Consider horizontal scaling

### Monitoring and Alerting

#### Key Metrics to Monitor

```yaml
metrics:
  business:
    - payment_success_rate
    - transaction_volume
    - revenue_processed
    - provider_distribution
  
  technical:
    - response_time_p95
    - error_rate
    - database_connection_pool
    - memory_usage
    - cpu_utilization
  
  security:
    - failed_authentication_attempts
    - suspicious_transaction_patterns
    - encryption_key_rotation_status
```

#### Alert Thresholds

```yaml
alerts:
  critical:
    - payment_success_rate < 95%
    - response_time_p95 > 5000ms
    - error_rate > 5%
    - database_connections > 90%
  
  warning:
    - payment_success_rate < 98%
    - response_time_p95 > 2000ms
    - error_rate > 1%
    - memory_usage > 80%
```

### Maintenance Windows

#### Scheduled Maintenance

**Monthly Maintenance Window:**
- **Time:** First Sunday of each month, 2:00-4:00 AM UTC
- **Duration:** 2 hours maximum
- **Activities:**
  - Database maintenance and optimization
  - Security patches and updates
  - Provider configuration updates
  - Performance tuning

**Maintenance Checklist:**
```bash
#!/bin/bash
# Pre-maintenance checklist

echo "Starting pre-maintenance checks..."

# 1. Verify backup completion
if [ ! -f "/backups/latest/full_backup.sql.gz" ]; then
  echo "ERROR: Latest backup not found"
  exit 1
fi

# 2. Check system health
./scripts/health-check.sh || exit 1

# 3. Notify stakeholders
curl -X POST $NOTIFICATION_WEBHOOK -d '{"message":"Maintenance window starting"}'

# 4. Scale down non-critical services
kubectl scale deployment payment-service-worker --replicas=1

echo "Pre-maintenance checks completed"
```

#### Emergency Maintenance

**Criteria for Emergency Maintenance:**
- Critical security vulnerabilities
- Data corruption issues
- Provider API changes requiring immediate updates
- Regulatory compliance requirements

**Emergency Response:**
1. Assess impact and urgency
2. Prepare rollback plan
3. Notify stakeholders immediately
4. Execute changes with minimal downtime
5. Monitor system closely post-deployment

## Support Contact Information

### Internal Contacts

| Role | Primary | Secondary | Contact |
|------|---------|-----------|---------|
| On-Call Engineer | John Doe | Jane Smith | +1-555-0123 |
| Engineering Manager | Alice Johnson | Bob Wilson | +1-555-0456 |
| DevOps Lead | Charlie Brown | Diana Prince | +1-555-0789 |
| Security Team | Eve Adams | Frank Miller | security@company.com |

### External Vendors

| Provider | Support Contact | Escalation | SLA |
|----------|----------------|------------|-----|
| Stripe | support@stripe.com | Critical: 1 hour | 99.9% |
| Iugu | suporte@iugu.com | Critical: 2 hours | 99.5% |
| AWS | aws-support | Critical: 15 minutes | 99.99% |
| MongoDB Atlas | support@mongodb.com | Critical: 1 hour | 99.95% |

### Documentation Updates

This document should be reviewed and updated:
- **Monthly:** During maintenance windows
- **After incidents:** Within 48 hours of resolution
- **Quarterly:** Comprehensive review of all procedures
- **Annually:** Full disaster recovery testing and validation