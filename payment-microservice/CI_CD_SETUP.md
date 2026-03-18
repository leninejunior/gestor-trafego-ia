# CI/CD Setup Guide

This document describes the CI/CD pipeline setup for the Payment Microservice.

## Overview

The CI/CD pipeline is built using GitHub Actions and includes:

- **Continuous Integration**: Automated testing, linting, and security scanning
- **Continuous Deployment**: Automated deployment to staging and production
- **Security Monitoring**: Daily security scans and dependency updates
- **Rollback Capability**: Automatic rollback on deployment failures

## Pipeline Structure

### 1. CI Pipeline (`ci-cd.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch

**Jobs:**
1. **Test**: Runs unit tests, integration tests, and coverage analysis
2. **Security**: Performs security audits and vulnerability scanning
3. **Build**: Builds and pushes Docker images to registry
4. **Deploy Staging**: Deploys to staging environment (develop branch)
5. **Deploy Production**: Deploys to production environment (main branch)
6. **Rollback**: Automatic rollback on deployment failure

### 2. Security Monitoring (`security-monitoring.yml`)

**Triggers:**
- Daily schedule (2 AM UTC)
- Manual trigger

**Jobs:**
1. **Dependency Check**: Scans for vulnerable dependencies
2. **Container Scan**: Scans Docker images for vulnerabilities
3. **License Check**: Validates license compliance

### 3. Dependency Updates (`dependency-update.yml`)

**Triggers:**
- Weekly schedule (Monday 9 AM UTC)
- Manual trigger

**Jobs:**
1. **Update Dependencies**: Updates patch and minor versions
2. **Test Updates**: Runs tests after updates
3. **Create PR**: Creates pull request with updates

## Required Secrets

Configure the following secrets in your GitHub repository:

### Container Registry
```
GITHUB_TOKEN - GitHub token for container registry access (automatically provided)
```

### Kubernetes Access
```
KUBE_CONFIG_STAGING - Base64 encoded kubeconfig for staging cluster
KUBE_CONFIG_PRODUCTION - Base64 encoded kubeconfig for production cluster
```

### Security Scanning
```
SNYK_TOKEN - Snyk API token for security scanning
```

### Notifications
```
SLACK_WEBHOOK_URL - Slack webhook URL for deployment notifications
```

## Environment Setup

### 1. GitHub Environments

Create the following environments in your GitHub repository:

#### Staging Environment
- **Protection Rules**: None (automatic deployment)
- **Environment Secrets**: 
  - `KUBE_CONFIG_STAGING`

#### Production Environment
- **Protection Rules**: 
  - Required reviewers (at least 1)
  - Wait timer (5 minutes)
- **Environment Secrets**: 
  - `KUBE_CONFIG_PRODUCTION`

### 2. Kubernetes Clusters

Ensure your Kubernetes clusters have:

- **Namespaces**: `staging`, `production`
- **RBAC**: Proper service accounts and permissions
- **Ingress Controller**: For external access
- **Monitoring**: Prometheus and Grafana (optional)

## Local Development

### Prerequisites

- Node.js 18+
- Docker
- kubectl (for deployments)
- Make (optional, for convenience)

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Setup pre-commit hooks:**
   ```bash
   npm run prepare
   ```

3. **Run tests:**
   ```bash
   npm test
   ```

4. **Build application:**
   ```bash
   npm run build
   ```

### Using Make Commands

```bash
# Development
make install          # Install dependencies
make test            # Run tests
make lint            # Run linting
make build           # Build application

# Docker
make docker-build    # Build Docker image
make docker-push     # Push to registry

# Deployment
make deploy-staging  # Deploy to staging
make deploy-prod     # Deploy to production
make rollback        # Rollback deployment
```

## Deployment Process

### Staging Deployment

1. **Trigger**: Push to `develop` branch
2. **Process**:
   - Run CI pipeline (tests, security, build)
   - Build and push Docker image
   - Deploy to staging environment
   - Run smoke tests
3. **Rollback**: Manual rollback if needed

### Production Deployment

1. **Trigger**: Push to `main` branch
2. **Process**:
   - Run CI pipeline (tests, security, build)
   - Build and push Docker image
   - Deploy to production environment (requires approval)
   - Run health checks
   - Send success notification
3. **Rollback**: Automatic rollback on failure

## Monitoring and Alerts

### Health Checks

The pipeline includes health checks at multiple levels:

- **Application Health**: `/health` endpoint
- **Readiness Check**: `/ready` endpoint
- **Kubernetes Probes**: Liveness and readiness probes

### Notifications

- **Slack Notifications**: Deployment success/failure notifications
- **GitHub Status**: Commit status updates
- **Email Alerts**: Security vulnerability notifications

## Security Considerations

### Image Security

- **Multi-stage builds**: Minimize attack surface
- **Non-root user**: Run containers as non-root
- **Vulnerability scanning**: Trivy and Snyk integration
- **Base image updates**: Regular security updates

### Secrets Management

- **GitHub Secrets**: Encrypted secret storage
- **Kubernetes Secrets**: Runtime secret management
- **Credential rotation**: Regular credential updates

### Access Control

- **RBAC**: Role-based access control
- **Environment protection**: Production deployment approval
- **Audit logging**: Complete audit trail

## Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check test results and linting errors
   - Verify dependencies are up to date
   - Review security scan results

2. **Deployment Failures**:
   - Check Kubernetes cluster status
   - Verify secrets and configurations
   - Review resource limits and quotas

3. **Health Check Failures**:
   - Check application logs
   - Verify database connectivity
   - Review external service dependencies

### Debug Commands

```bash
# Check deployment status
kubectl get pods -n staging -l app=payment-microservice

# View application logs
kubectl logs -f deployment/payment-microservice -n staging

# Check service endpoints
kubectl get svc -n staging payment-microservice

# Run manual health check
kubectl run debug --rm -i --restart=Never \
  --image=curlimages/curl:latest \
  -- curl -v http://payment-microservice.staging.svc.cluster.local:3000/health
```

## Best Practices

### Code Quality

- **Pre-commit hooks**: Automated code formatting and linting
- **Test coverage**: Minimum 90% coverage requirement
- **Type safety**: Strict TypeScript configuration
- **Security scanning**: Automated vulnerability detection

### Deployment Strategy

- **Blue-green deployment**: Zero-downtime deployments
- **Canary releases**: Gradual rollout for production
- **Feature flags**: Safe feature deployment
- **Rollback strategy**: Quick rollback capability

### Monitoring

- **Application metrics**: Performance and business metrics
- **Infrastructure monitoring**: Resource usage and health
- **Log aggregation**: Centralized logging
- **Alerting**: Proactive issue detection

## Maintenance

### Regular Tasks

- **Dependency updates**: Weekly automated updates
- **Security patches**: Immediate application of critical patches
- **Performance monitoring**: Regular performance reviews
- **Backup verification**: Regular backup and restore tests

### Quarterly Reviews

- **Pipeline optimization**: Review and optimize CI/CD performance
- **Security audit**: Comprehensive security review
- **Cost optimization**: Review and optimize infrastructure costs
- **Documentation updates**: Keep documentation current