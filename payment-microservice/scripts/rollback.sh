#!/bin/bash

# Rollback script for payment microservice
set -e

ENVIRONMENT=${1:-staging}
REVISION=${2:-}
NAMESPACE=${ENVIRONMENT}

echo "Rolling back payment microservice in ${ENVIRONMENT} environment..."

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo "Error: Environment must be 'staging' or 'production'"
    exit 1
fi

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "Error: kubectl is not installed"
    exit 1
fi

# Show rollout history
echo "Rollout history:"
kubectl rollout history deployment/payment-microservice -n ${NAMESPACE}

# Perform rollback
if [[ -n "$REVISION" ]]; then
    echo "Rolling back to revision ${REVISION}..."
    kubectl rollout undo deployment/payment-microservice --to-revision=${REVISION} -n ${NAMESPACE}
else
    echo "Rolling back to previous revision..."
    kubectl rollout undo deployment/payment-microservice -n ${NAMESPACE}
fi

# Wait for rollback to complete
echo "Waiting for rollback to complete..."
kubectl rollout status deployment/payment-microservice -n ${NAMESPACE} --timeout=300s

# Run health check
echo "Running health check after rollback..."
kubectl run health-check-rollback-$(date +%s) --rm -i --restart=Never \
    --image=curlimages/curl:latest \
    --namespace=${NAMESPACE} \
    -- curl -f http://payment-microservice.${NAMESPACE}.svc.cluster.local:3000/health

echo "Rollback completed successfully!"

# Show current status
kubectl get pods -n ${NAMESPACE} -l app=payment-microservice