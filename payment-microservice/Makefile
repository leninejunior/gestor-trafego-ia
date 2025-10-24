# Makefile for Payment Microservice

.PHONY: help install build test lint format clean docker-build docker-push deploy rollback

# Default target
help:
	@echo "Available targets:"
	@echo "  install      - Install dependencies"
	@echo "  build        - Build the application"
	@echo "  test         - Run tests"
	@echo "  test-watch   - Run tests in watch mode"
	@echo "  test-coverage - Run tests with coverage"
	@echo "  lint         - Run linting"
	@echo "  format       - Format code"
	@echo "  clean        - Clean build artifacts"
	@echo "  docker-build - Build Docker image"
	@echo "  docker-push  - Push Docker image to registry"
	@echo "  deploy-staging - Deploy to staging environment"
	@echo "  deploy-prod  - Deploy to production environment"
	@echo "  rollback     - Rollback deployment"

# Variables
VERSION ?= latest
REGISTRY ?= ghcr.io/your-org
IMAGE_NAME = payment-microservice
FULL_IMAGE_NAME = $(REGISTRY)/$(IMAGE_NAME):$(VERSION)

# Development targets
install:
	npm ci

build:
	npm run build

test:
	npm test

test-watch:
	npm run test:watch

test-coverage:
	npm run test:coverage

lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

clean:
	rm -rf dist/
	rm -rf coverage/
	rm -rf node_modules/

# Docker targets
docker-build:
	docker build -t $(FULL_IMAGE_NAME) .
	docker tag $(FULL_IMAGE_NAME) $(REGISTRY)/$(IMAGE_NAME):latest

docker-push: docker-build
	docker push $(FULL_IMAGE_NAME)
	docker push $(REGISTRY)/$(IMAGE_NAME):latest

# Deployment targets
deploy-staging:
	./scripts/deploy.sh staging $(VERSION)

deploy-prod:
	./scripts/deploy.sh production $(VERSION)

rollback:
	./scripts/rollback.sh $(ENV) $(REVISION)

# CI/CD targets
ci-test: install lint test-coverage

ci-build: ci-test build docker-build

ci-deploy-staging: ci-build
	./scripts/deploy.sh staging $(VERSION)

ci-deploy-prod: ci-build
	./scripts/deploy.sh production $(VERSION)

# Development environment
dev-up:
	docker-compose up -d

dev-down:
	docker-compose down

dev-logs:
	docker-compose logs -f

# Database operations
db-migrate:
	npm run migration:run

db-rollback:
	npm run migration:revert

db-seed:
	npm run seed:run

# Security
security-audit:
	npm audit
	docker run --rm -v $(PWD):/app aquasec/trivy fs /app

# Pre-commit setup
setup-hooks:
	npm install -g pre-commit
	pre-commit install