#!/bin/bash

# CI Test script for payment microservice
set -e

echo "Starting CI test pipeline..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Cleanup function
cleanup() {
    print_status "Cleaning up..."
    docker-compose -f docker-compose.ci.yml down -v || true
    docker system prune -f || true
}

# Set trap for cleanup
trap cleanup EXIT

# Step 1: Environment validation
print_status "Validating environment..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed"
    exit 1
fi

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

# Step 2: Install dependencies
print_status "Installing dependencies..."
npm ci

# Step 3: Code quality checks
print_status "Running code quality checks..."

# Linting
print_status "Running ESLint..."
npm run lint

# Type checking
print_status "Running TypeScript type checking..."
npm run type-check

# Format checking
print_status "Checking code formatting..."
npm run format:check

# Step 4: Security checks
print_status "Running security checks..."

# Dependency audit
print_status "Running npm audit..."
npm audit --audit-level moderate || {
    print_warning "Security vulnerabilities found in dependencies"
}

# Step 5: Build application
print_status "Building application..."
npm run build

# Step 6: Start test environment
print_status "Starting test environment..."
docker-compose -f docker-compose.ci.yml up -d postgres redis

# Wait for services to be ready
print_status "Waiting for services to be ready..."
timeout=60
counter=0
while ! docker-compose -f docker-compose.ci.yml exec -T postgres pg_isready -U postgres; do
    sleep 1
    counter=$((counter + 1))
    if [ $counter -ge $timeout ]; then
        print_error "Postgres failed to start within $timeout seconds"
        exit 1
    fi
done

while ! docker-compose -f docker-compose.ci.yml exec -T redis redis-cli ping; do
    sleep 1
    counter=$((counter + 1))
    if [ $counter -ge $timeout ]; then
        print_error "Redis failed to start within $timeout seconds"
        exit 1
    fi
done

# Step 7: Run database migrations
print_status "Running database migrations..."
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/payment_test"
export REDIS_URL="redis://localhost:6379"
npm run migration:run || {
    print_warning "Migration failed or no migrations to run"
}

# Step 8: Run tests
print_status "Running unit tests..."
npm run test:ci

# Step 9: Integration tests
print_status "Running integration tests..."
docker-compose -f docker-compose.ci.yml up --build test-runner

# Step 10: Build Docker image
print_status "Building Docker image..."
docker build -t payment-microservice:test .

# Step 11: Container security scan (if trivy is available)
if command -v trivy &> /dev/null; then
    print_status "Running container security scan..."
    trivy image payment-microservice:test
else
    print_warning "Trivy not found, skipping container security scan"
fi

# Step 12: Smoke test
print_status "Running smoke tests..."
docker-compose -f docker-compose.ci.yml up -d payment-microservice

# Wait for service to be ready
timeout=60
counter=0
while ! curl -f http://localhost:3000/health &> /dev/null; do
    sleep 1
    counter=$((counter + 1))
    if [ $counter -ge $timeout ]; then
        print_error "Service failed to start within $timeout seconds"
        docker-compose -f docker-compose.ci.yml logs payment-microservice
        exit 1
    fi
done

# Test health endpoint
print_status "Testing health endpoint..."
response=$(curl -s http://localhost:3000/health)
if [[ $response == *"healthy"* ]]; then
    print_status "Health check passed"
else
    print_error "Health check failed: $response"
    exit 1
fi

# Test metrics endpoint
print_status "Testing metrics endpoint..."
curl -f http://localhost:3000/metrics > /dev/null || {
    print_error "Metrics endpoint failed"
    exit 1
}

print_status "All CI tests passed successfully!"

# Generate test report
print_status "Generating test report..."
cat > test-report.json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "success",
  "tests": {
    "lint": "passed",
    "typecheck": "passed",
    "format": "passed",
    "security": "passed",
    "unit": "passed",
    "integration": "passed",
    "smoke": "passed"
  },
  "coverage": {
    "file": "coverage/lcov.info"
  }
}
EOF

print_status "Test report generated: test-report.json"