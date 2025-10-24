#!/bin/bash

# Setup monitoring infrastructure for payment microservice
set -e

NAMESPACE=${1:-monitoring}

echo "Setting up monitoring infrastructure in namespace: ${NAMESPACE}"

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

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed"
    exit 1
fi

# Create monitoring namespace
print_status "Creating monitoring namespace..."
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Label namespace for monitoring
kubectl label namespace ${NAMESPACE} monitoring=enabled --overwrite

# Apply monitoring components
print_status "Deploying Elasticsearch..."
kubectl apply -f k8s/monitoring/elasticsearch.yaml -n ${NAMESPACE}

print_status "Waiting for Elasticsearch to be ready..."
kubectl wait --for=condition=ready pod -l app=elasticsearch -n ${NAMESPACE} --timeout=300s

print_status "Deploying Logstash..."
kubectl apply -f k8s/monitoring/logstash.yaml -n ${NAMESPACE}

print_status "Deploying Kibana..."
kubectl apply -f k8s/monitoring/kibana.yaml -n ${NAMESPACE}

print_status "Deploying Prometheus..."
kubectl apply -f k8s/monitoring/prometheus.yaml -n ${NAMESPACE}

print_status "Deploying Alertmanager..."
kubectl apply -f k8s/monitoring/alertmanager.yaml -n ${NAMESPACE}

print_status "Deploying Grafana..."
kubectl apply -f k8s/monitoring/grafana.yaml -n ${NAMESPACE}

print_status "Deploying Jaeger..."
kubectl apply -f k8s/monitoring/jaeger.yaml -n ${NAMESPACE}

# Wait for all deployments to be ready
print_status "Waiting for all monitoring components to be ready..."

components=("elasticsearch" "logstash" "kibana" "prometheus" "alertmanager" "grafana" "jaeger-collector" "jaeger-query")

for component in "${components[@]}"; do
    print_status "Waiting for ${component} to be ready..."
    kubectl wait --for=condition=available deployment/${component} -n ${NAMESPACE} --timeout=300s || {
        print_warning "${component} deployment not found, checking statefulset..."
        kubectl wait --for=condition=ready pod -l app=${component} -n ${NAMESPACE} --timeout=300s || {
            print_warning "${component} might not be ready yet"
        }
    }
done

# Create ingress for monitoring services (optional)
print_status "Creating ingress for monitoring services..."
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: monitoring-ingress
  namespace: ${NAMESPACE}
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/auth-secret: monitoring-auth
    nginx.ingress.kubernetes.io/auth-realm: 'Authentication Required - Monitoring'
spec:
  rules:
  - host: grafana.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: grafana
            port:
              number: 3000
  - host: prometheus.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: prometheus
            port:
              number: 9090
  - host: kibana.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: kibana
            port:
              number: 5601
  - host: jaeger.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: jaeger-query
            port:
              number: 16686
EOF

# Create basic auth secret for monitoring access
print_status "Creating basic auth for monitoring access..."
htpasswd -cb auth admin monitoring123
kubectl create secret generic monitoring-auth --from-file=auth -n ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
rm -f auth

# Display access information
print_status "Monitoring setup completed!"
echo ""
echo "Access URLs (configure DNS or use port-forwarding):"
echo "  Grafana:    http://grafana.yourdomain.com (admin/admin123)"
echo "  Prometheus: http://prometheus.yourdomain.com"
echo "  Kibana:     http://kibana.yourdomain.com"
echo "  Jaeger:     http://jaeger.yourdomain.com"
echo ""
echo "Port-forwarding commands:"
echo "  kubectl port-forward svc/grafana 3000:3000 -n ${NAMESPACE}"
echo "  kubectl port-forward svc/prometheus 9090:9090 -n ${NAMESPACE}"
echo "  kubectl port-forward svc/kibana 5601:5601 -n ${NAMESPACE}"
echo "  kubectl port-forward svc/jaeger-query 16686:16686 -n ${NAMESPACE}"
echo ""
echo "Basic auth credentials: admin/monitoring123"

# Check status of all components
print_status "Current status of monitoring components:"
kubectl get pods -n ${NAMESPACE} -o wide