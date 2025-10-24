@echo off
REM Deployment script for payment microservice (Windows)
setlocal enabledelayedexpansion

set ENVIRONMENT=%1
set IMAGE_TAG=%2
set NAMESPACE=%ENVIRONMENT%

if "%ENVIRONMENT%"=="" set ENVIRONMENT=staging
if "%IMAGE_TAG%"=="" set IMAGE_TAG=latest

echo Deploying payment microservice to %ENVIRONMENT% environment...

REM Validate environment
if not "%ENVIRONMENT%"=="staging" if not "%ENVIRONMENT%"=="production" (
    echo Error: Environment must be 'staging' or 'production'
    exit /b 1
)

REM Check if kubectl is available
kubectl version --client >nul 2>&1
if errorlevel 1 (
    echo Error: kubectl is not installed
    exit /b 1
)

REM Check if namespace exists
kubectl get namespace %NAMESPACE% >nul 2>&1
if errorlevel 1 (
    echo Creating namespace %NAMESPACE%...
    kubectl create namespace %NAMESPACE%
)

REM Apply configurations
echo Applying Kubernetes configurations...
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml -n %NAMESPACE%
kubectl apply -f k8s/secrets.yaml -n %NAMESPACE%
kubectl apply -f k8s/deployment.yaml -n %NAMESPACE%
kubectl apply -f k8s/service.yaml -n %NAMESPACE%
kubectl apply -f k8s/ingress.yaml -n %NAMESPACE%
kubectl apply -f k8s/hpa.yaml -n %NAMESPACE%

REM Update image tag
echo Updating image to %IMAGE_TAG%...
kubectl set image deployment/payment-microservice payment-microservice=ghcr.io/your-org/payment-microservice:%IMAGE_TAG% -n %NAMESPACE%

REM Wait for rollout to complete
echo Waiting for deployment to complete...
kubectl rollout status deployment/payment-microservice -n %NAMESPACE% --timeout=600s

REM Run health check
echo Running health check...
for /f %%i in ('powershell -command "Get-Date -Format 'yyyyMMddHHmmss'"') do set timestamp=%%i
kubectl run health-check-%timestamp% --rm -i --restart=Never --image=curlimages/curl:latest --namespace=%NAMESPACE% -- curl -f http://payment-microservice.%NAMESPACE%.svc.cluster.local:3000/health

echo Deployment completed successfully!

REM Show deployment status
kubectl get pods -n %NAMESPACE% -l app=payment-microservice
kubectl get svc -n %NAMESPACE% payment-microservice