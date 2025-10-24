# Troubleshooting Guide

## Overview

This guide provides step-by-step troubleshooting procedures for common issues in the Payment Microservice. Each section includes symptoms, diagnosis steps, and resolution procedures.

## Quick Reference

### Emergency Contacts
- **On-Call Engineer**: +1-555-0123
- **Engineering Manager**: +1-555-0456
- **DevOps Team**: devops@company.com

### Critical Commands
```bash
# Check service health
kubectl get pods -l app=payment-service
curl http://payment-service/health

# View recent logs
kubectl logs -l app=payment-service --tail=100

# Check database connectivity
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"

# Restart services
kubectl rollout restart deployment/payment-service
```

## Common Issues

### 1. Payment Processing Failures

#### Symptoms
- High error rates in payment endpoints
- Timeout errors from providers
- Customer complaints about failed transactions
- Increased 4xx/5xx HTTP responses

#### Diagnosis Steps

**Step 1: Check Overall System Health**
```bash
# Check service status
kubectl get pods -l app=payment-service
kubectl describe pods -l app=payment-service

# Check service endpoints
curl -f http://payment-service/health || echo "Health check failed"
curl -f http://payment-service/ready || echo "Readiness check failed"
```

**Step 2: Analyze Error Patterns**
```bash
# Check recent error logs
kubectl logs -l app=payment-service --since=1h | grep -i error

# Check error rates by provider
kubectl logs -l app=payment-service --since=1h | \
  grep "payment_failed" | \
  awk '{print $5}' | sort | uniq -c | sort -nr

# Check database for failed transactions
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT 
    provider_name,
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration
  FROM transactions 
  WHERE created_at > NOW() - INTERVAL '1 hour'
  GROUP BY provider_name, status
  ORDER BY count DESC;
"
```

**Step 3: Check Provider Status**
```bash
# Check provider health endpoints
curl -H "Authorization: Bearer $API_TOKEN" \
  http://payment-service/api/v2/providers/health

# Test individual providers
curl -X POST http://payment-service/api/v2/providers/stripe/test \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "currency": "USD"}'
```

#### Resolution Steps

**For Provider API Issues:**
1. Check provider status pages (Stripe, Iugu, etc.)
2. Verify API credentials are valid and not expired
3. Check rate limiting settings
4. Test with smaller amounts first
5. Enable failover to backup providers

```bash
# Disable problematic provider temporarily
curl -X PATCH http://payment-service/api/v2/providers/stripe \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Enable failover
curl -X POST http://payment-service/api/v2/failover/enable \
  -H "Content-Type: application/json" \
  -d '{"primary": "iugu", "fallback": ["mercadopago", "pagseguro"]}'
```

**For Database Issues:**
```bash
# Check database connections
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT count(*) as active_connections 
  FROM pg_stat_activity 
  WHERE state = 'active';
"

# Check for long-running queries
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
  FROM pg_stat_activity 
  WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
"

# Kill long-running queries if necessary
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE (now() - pg_stat_activity.query_start) > interval '10 minutes';
"
```

### 2. High Memory Usage / Memory Leaks

#### Symptoms
- Gradual increase in memory usage over time
- Pod restarts due to OOMKilled
- Slow response times
- Memory usage alerts

#### Diagnosis Steps

**Step 1: Monitor Memory Usage**
```bash
# Check current memory usage
kubectl top pods -l app=payment-service

# Check memory limits and requests
kubectl describe pods -l app=payment-service | grep -A 5 -B 5 memory

# Monitor memory usage over time
kubectl logs -l app=payment-service | grep "memory" | tail -20
```

**Step 2: Analyze Memory Patterns**
```bash
# Generate heap dump (Node.js)
kubectl exec -it payment-service-pod -- kill -USR2 1

# Check for memory leaks in logs
kubectl logs -l app=payment-service | grep -i "heap\|memory\|gc"

# Check database connection pool
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT count(*) as total_connections,
         count(*) FILTER (WHERE state = 'active') as active_connections,
         count(*) FILTER (WHERE state = 'idle') as idle_connections
  FROM pg_stat_activity;
"
```

#### Resolution Steps

**Immediate Actions:**
```bash
# Restart affected pods
kubectl delete pods -l app=payment-service

# Scale up replicas temporarily
kubectl scale deployment payment-service --replicas=5

# Increase memory limits if needed
kubectl patch deployment payment-service -p '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [
          {
            "name": "payment-service",
            "resources": {
              "limits": {
                "memory": "1Gi"
              }
            }
          }
        ]
      }
    }
  }
}'
```

**Long-term Fixes:**
1. Review recent code changes for memory leaks
2. Check for unclosed database connections
3. Implement connection pooling
4. Add memory monitoring and alerts
5. Consider horizontal scaling

### 3. Database Connection Issues

#### Symptoms
- "Connection refused" errors
- "Too many connections" errors
- Slow database queries
- Connection timeouts

#### Diagnosis Steps

**Step 1: Check Database Status**
```bash
# Check if database is running
pg_isready -h $DB_HOST -p $DB_PORT

# Check connection limits
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT setting FROM pg_settings WHERE name = 'max_connections';
"

# Check current connections
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT count(*) FROM pg_stat_activity;
"
```

**Step 2: Analyze Connection Patterns**
```bash
# Check connections by application
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT application_name, count(*) 
  FROM pg_stat_activity 
  GROUP BY application_name;
"

# Check idle connections
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT count(*) as idle_connections 
  FROM pg_stat_activity 
  WHERE state = 'idle' AND state_change < now() - interval '5 minutes';
"
```

#### Resolution Steps

**Immediate Actions:**
```bash
# Kill idle connections
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE state = 'idle' AND state_change < now() - interval '10 minutes';
"

# Restart connection pool
kubectl rollout restart deployment/payment-service
```

**Configuration Fixes:**
```bash
# Update connection pool settings
kubectl set env deployment/payment-service \
  DB_POOL_MIN=5 \
  DB_POOL_MAX=20 \
  DB_POOL_IDLE_TIMEOUT=30000

# Increase database max_connections (requires DB restart)
# Edit postgresql.conf: max_connections = 200
```

### 4. Provider API Rate Limiting

#### Symptoms
- 429 "Too Many Requests" errors
- Sudden drop in successful payments
- Provider-specific error messages about rate limits

#### Diagnosis Steps

**Step 1: Check Rate Limit Status**
```bash
# Check recent rate limit errors
kubectl logs -l app=payment-service --since=1h | grep -i "rate\|429\|too many"

# Check provider-specific logs
kubectl logs -l app=payment-service --since=1h | grep "stripe\|iugu\|pagseguro\|mercadopago"
```

**Step 2: Analyze Request Patterns**
```bash
# Check request frequency by provider
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT 
    provider_name,
    DATE_TRUNC('minute', created_at) as minute,
    COUNT(*) as requests_per_minute
  FROM transactions 
  WHERE created_at > NOW() - INTERVAL '1 hour'
  GROUP BY provider_name, DATE_TRUNC('minute', created_at)
  ORDER BY requests_per_minute DESC
  LIMIT 20;
"
```

#### Resolution Steps

**Immediate Actions:**
```bash
# Enable request throttling
kubectl set env deployment/payment-service \
  RATE_LIMIT_ENABLED=true \
  RATE_LIMIT_REQUESTS_PER_MINUTE=100

# Distribute load across providers
curl -X POST http://payment-service/api/v2/load-balancer/rebalance \
  -H "Content-Type: application/json" \
  -d '{"strategy": "round_robin"}'
```

**Long-term Solutions:**
1. Implement exponential backoff
2. Add request queuing
3. Negotiate higher rate limits with providers
4. Implement intelligent load balancing

### 5. Webhook Processing Issues

#### Symptoms
- Missed webhook events
- Duplicate webhook processing
- Webhook validation failures
- Delayed status updates

#### Diagnosis Steps

**Step 1: Check Webhook Logs**
```bash
# Check recent webhook activity
kubectl logs -l app=payment-service --since=1h | grep webhook

# Check webhook validation errors
kubectl logs -l app=payment-service --since=1h | grep "webhook.*validation.*failed"

# Check webhook processing times
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT 
    provider_name,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_processing_time
  FROM audit_logs 
  WHERE action = 'webhook_processed' 
    AND created_at > NOW() - INTERVAL '1 hour'
  GROUP BY provider_name;
"
```

**Step 2: Verify Webhook Configuration**
```bash
# Check webhook endpoints
curl -X GET http://payment-service/api/v2/webhooks/config

# Test webhook signature validation
curl -X POST http://payment-service/api/v2/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{"provider": "stripe", "test_signature": true}'
```

#### Resolution Steps

**For Validation Issues:**
```bash
# Update webhook secrets
kubectl create secret generic webhook-secrets \
  --from-literal=stripe-secret=$STRIPE_WEBHOOK_SECRET \
  --from-literal=iugu-secret=$IUGU_WEBHOOK_SECRET \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart webhook processors
kubectl rollout restart deployment/payment-service-webhook-processor
```

**For Processing Delays:**
```bash
# Scale up webhook processors
kubectl scale deployment payment-service-webhook-processor --replicas=5

# Check webhook queue
redis-cli -h $REDIS_HOST LLEN webhook_queue
```

### 6. SSL/TLS Certificate Issues

#### Symptoms
- SSL handshake failures
- Certificate validation errors
- "Certificate expired" errors
- Provider API connection failures

#### Diagnosis Steps

**Step 1: Check Certificate Status**
```bash
# Check certificate expiration
echo | openssl s_client -servername payment-service.company.com \
  -connect payment-service.company.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# Check certificate chain
curl -vI https://payment-service.company.com/health

# Check provider certificate validation
openssl s_client -connect api.stripe.com:443 -verify_return_error
```

#### Resolution Steps

**For Expired Certificates:**
```bash
# Renew Let's Encrypt certificate
certbot renew --nginx

# Update Kubernetes TLS secret
kubectl create secret tls payment-service-tls \
  --cert=/etc/letsencrypt/live/payment-service.company.com/fullchain.pem \
  --key=/etc/letsencrypt/live/payment-service.company.com/privkey.pem \
  --dry-run=client -o yaml | kubectl apply -f -
```

## Performance Issues

### Slow Response Times

#### Diagnosis
```bash
# Check response time metrics
kubectl logs -l app=payment-service | grep "response_time" | tail -20

# Check database query performance
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT query, mean_time, calls 
  FROM pg_stat_statements 
  ORDER BY mean_time DESC 
  LIMIT 10;
"

# Check for blocking queries
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT blocked_locks.pid AS blocked_pid,
         blocked_activity.usename AS blocked_user,
         blocking_locks.pid AS blocking_pid,
         blocking_activity.usename AS blocking_user,
         blocked_activity.query AS blocked_statement,
         blocking_activity.query AS current_statement_in_blocking_process
  FROM pg_catalog.pg_locks blocked_locks
  JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
  JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
  WHERE NOT blocked_locks.granted;
"
```

#### Resolution
```bash
# Add database indexes for slow queries
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  CREATE INDEX CONCURRENTLY idx_transactions_created_at_provider 
  ON transactions(created_at, provider_name);
"

# Increase connection pool size
kubectl set env deployment/payment-service DB_POOL_MAX=50

# Enable query caching
kubectl set env deployment/payment-service ENABLE_QUERY_CACHE=true
```

## Monitoring and Alerting

### Key Metrics to Monitor

```bash
# Check Prometheus metrics
curl http://payment-service:3000/metrics | grep payment_

# Key metrics to watch:
# - payment_success_rate
# - payment_response_time_p95
# - database_connection_pool_usage
# - memory_usage_percentage
# - error_rate_per_provider
```

### Setting Up Alerts

```yaml
# Prometheus alert rules
groups:
- name: payment-service
  rules:
  - alert: HighPaymentFailureRate
    expr: payment_failure_rate > 0.05
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High payment failure rate detected"
      
  - alert: DatabaseConnectionPoolExhaustion
    expr: db_connection_pool_usage > 0.9
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "Database connection pool nearly exhausted"
```

## Recovery Procedures

### Service Recovery Checklist

1. **Assess Impact**
   - Check error rates and affected users
   - Identify root cause
   - Estimate recovery time

2. **Immediate Actions**
   - Stop traffic to affected services
   - Enable failover mechanisms
   - Scale healthy services

3. **Fix Implementation**
   - Apply hotfixes or rollback
   - Verify fix in staging
   - Deploy to production

4. **Verification**
   - Run health checks
   - Monitor key metrics
   - Verify customer impact resolved

5. **Post-Incident**
   - Document incident
   - Schedule post-mortem
   - Implement preventive measures

### Rollback Procedures

```bash
# Rollback Kubernetes deployment
kubectl rollout undo deployment/payment-service

# Rollback database changes
./scripts/disaster-recovery/restore-database.sh rollback

# Rollback configuration changes
kubectl apply -f k8s/config-backup/
```

## Contact Information

### Internal Escalation
1. **Level 1**: On-call Engineer (+1-555-0123)
2. **Level 2**: Senior Engineer (+1-555-0456)
3. **Level 3**: Engineering Manager (+1-555-0789)

### External Vendors
- **Stripe Support**: support@stripe.com
- **Iugu Support**: suporte@iugu.com
- **AWS Support**: Create ticket in AWS Console
- **MongoDB Atlas**: support@mongodb.com

### Emergency Procedures
- **After Hours**: Call on-call engineer directly
- **Critical Issues**: Page engineering manager
- **Security Issues**: Contact security@company.com immediately