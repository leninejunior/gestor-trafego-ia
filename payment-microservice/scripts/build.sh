#!/bin/bash

# Build script for payment microservice
set -e

VERSION=${1:-latest}
REGISTRY=${2:-ghcr.io/your-org}
PUSH=${3:-false}

echo "Building payment microservice version ${VERSION}..."

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf dist/
rm -rf coverage/

# Install dependencies
echo "Installing dependencies..."
npm ci

# Run linting
echo "Running linting..."
npm run lint

# Run type checking
echo "Running type checking..."
npx tsc --noEmit

# Run tests
echo "Running tests..."
npm run test:coverage

# Build application
echo "Building application..."
npm run build

# Build Docker image
echo "Building Docker image..."
docker build -t ${REGISTRY}/payment-microservice:${VERSION} .
docker tag ${REGISTRY}/payment-microservice:${VERSION} ${REGISTRY}/payment-microservice:latest

# Security scan
echo "Running security scan..."
if command -v trivy &> /dev/null; then
    trivy image ${REGISTRY}/payment-microservice:${VERSION}
else
    echo "Warning: Trivy not found, skipping security scan"
fi

# Push to registry if requested
if [[ "$PUSH" == "true" ]]; then
    echo "Pushing to registry..."
    docker push ${REGISTRY}/payment-microservice:${VERSION}
    docker push ${REGISTRY}/payment-microservice:latest
fi

echo "Build completed successfully!"
echo "Image: ${REGISTRY}/payment-microservice:${VERSION}"