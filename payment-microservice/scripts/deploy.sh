#!/bin/bash

# Deployment script for payment microservice
set -e

ENVIRONMENT=${1:-staging}
IMAGE_TAG=${2:-latest}
NAMESPACE=${ENVIRONMENT}

echo "Deploying payment microservice to ${ENVIRONMENT} environment..."

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

# Check if namespace exists
if ! kubectl get namespace ${NAMESPACE} &> /dev/null; then
    echo "Creating namespace ${NAMESPACE}..."
    kubectl create namespace ${NAMESPACE}
fi

# Apply configurations
echo "Applying Kubernetes configurations..."
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml -n ${NAMESPACE}
kubectl apply -f k8s/secrets.yaml -n ${NAMESPACE}
kubectl apply -f k8s/deployment.yaml -n ${NAMESPACE}
kubectl apply -f k8s/service.yaml -n ${NAMESPACE}
kubectl apply -f k8s/ingress.yaml -n ${NAMESPACE}
kubectl apply -f k8s/hpa.yaml -n ${NAMESPACE}

# Update image tag
echo "Updating image to ${IMAGE_TAG}..."
kubectl set image deployment/payment-microservice \
    payment-microservice=ghcr.io/your-org/payment-microservice:${IMAGE_TAG} \
    -n ${NAMESPACE}

# Wait for rollout to complete
echo "Waiting for deployment to complete..."
kubectl rollout status deployment/payment-microservice -n ${NAMESPACE} --timeout=600s

# Run health check
echo "Running health check..."
kubectl run health-check-$(date +%s) --rm -i --restart=Never \
    --image=curlimages/curl:latest \
    --namespace=${NAMESPACE} \
    -- curl -f http://payment-microservice.${NAMESPACE}.svc.cluster.local:3000/health

echo "Deployment completed successfully!"

# Show deployment status
kubectl get pods -n ${NAMESPACE} -l app=payment-microservice
kubectl get svc -n ${NAMESPACE} payment-microservice