#!/bin/bash

# Teardown monitoring infrastructure for payment microservice
set -e

NAMESPACE=${1:-monitoring}
FORCE=${2:-false}

echo "Tearing down monitoring infrastructure in namespace: ${NAMESPACE}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Confirmation prompt
if [[ "$FORCE" != "true" ]]; then
    echo -e "${YELLOW}WARNING: This will delete all monitoring infrastructure in namespace '${NAMESPACE}'${NC}"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Operation cancelled"
        exit 0
    fi
fi

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed"
    exit 1
fi

# Check if namespace exists
if ! kubectl get namespace ${NAMESPACE} &> /dev/null; then
    print_warning "Namespace ${NAMESPACE} does not exist"
    exit 0
fi

# Delete monitoring components
print_status "Deleting Jaeger components..."
kubectl delete -f k8s/monitoring/jaeger.yaml -n ${NAMESPACE} --ignore-not-found=true

print_status "Deleting Grafana..."
kubectl delete -f k8s/monitoring/grafana.yaml -n ${NAMESPACE} --ignore-not-found=true

print_status "Deleting Alertmanager..."
kubectl delete -f k8s/monitoring/alertmanager.yaml -n ${NAMESPACE} --ignore-not-found=true

print_status "Deleting Prometheus..."
kubectl delete -f k8s/monitoring/prometheus.yaml -n ${NAMESPACE} --ignore-not-found=true

print_status "Deleting Kibana..."
kubectl delete -f k8s/monitoring/kibana.yaml -n ${NAMESPACE} --ignore-not-found=true

print_status "Deleting Logstash..."
kubectl delete -f k8s/monitoring/logstash.yaml -n ${NAMESPACE} --ignore-not-found=true

print_status "Deleting Elasticsearch..."
kubectl delete -f k8s/monitoring/elasticsearch.yaml -n ${NAMESPACE} --ignore-not-found=true

# Delete ingress and secrets
print_status "Deleting monitoring ingress..."
kubectl delete ingress monitoring-ingress -n ${NAMESPACE} --ignore-not-found=true

print_status "Deleting monitoring auth secret..."
kubectl delete secret monitoring-auth -n ${NAMESPACE} --ignore-not-found=true

# Delete PVCs (optional - data will be lost)
if [[ "$FORCE" == "true" ]]; then
    print_warning "Deleting persistent volume claims (data will be lost)..."
    kubectl delete pvc --all -n ${NAMESPACE}
fi

# Wait for pods to terminate
print_status "Waiting for pods to terminate..."
kubectl wait --for=delete pod --all -n ${NAMESPACE} --timeout=300s || {
    print_warning "Some pods may still be terminating"
}

# Optionally delete the namespace
if [[ "$FORCE" == "true" ]]; then
    print_status "Deleting monitoring namespace..."
    kubectl delete namespace ${NAMESPACE} --ignore-not-found=true
fi

print_status "Monitoring infrastructure teardown completed!"

# Show remaining resources
if kubectl get namespace ${NAMESPACE} &> /dev/null; then
    print_status "Remaining resources in namespace ${NAMESPACE}:"
    kubectl get all -n ${NAMESPACE}
fi