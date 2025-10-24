@echo off
REM Build script for payment microservice (Windows)
setlocal enabledelayedexpansion

set VERSION=%1
set REGISTRY=%2
set PUSH=%3

if "%VERSION%"=="" set VERSION=latest
if "%REGISTRY%"=="" set REGISTRY=ghcr.io/your-org
if "%PUSH%"=="" set PUSH=false

echo Building payment microservice version %VERSION%...

REM Clean previous builds
echo Cleaning previous builds...
if exist dist rmdir /s /q dist
if exist coverage rmdir /s /q coverage

REM Install dependencies
echo Installing dependencies...
npm ci

REM Run linting
echo Running linting...
npm run lint
if errorlevel 1 (
    echo Linting failed!
    exit /b 1
)

REM Run type checking
echo Running type checking...
npx tsc --noEmit
if errorlevel 1 (
    echo Type checking failed!
    exit /b 1
)

REM Run tests
echo Running tests...
npm run test:coverage
if errorlevel 1 (
    echo Tests failed!
    exit /b 1
)

REM Build application
echo Building application...
npm run build
if errorlevel 1 (
    echo Build failed!
    exit /b 1
)

REM Build Docker image
echo Building Docker image...
docker build -t %REGISTRY%/payment-microservice:%VERSION% .
if errorlevel 1 (
    echo Docker build failed!
    exit /b 1
)

docker tag %REGISTRY%/payment-microservice:%VERSION% %REGISTRY%/payment-microservice:latest

REM Security scan (if trivy is available)
echo Running security scan...
trivy image %REGISTRY%/payment-microservice:%VERSION% 2>nul
if errorlevel 1 (
    echo Warning: Trivy not found or security issues detected
)

REM Push to registry if requested
if "%PUSH%"=="true" (
    echo Pushing to registry...
    docker push %REGISTRY%/payment-microservice:%VERSION%
    docker push %REGISTRY%/payment-microservice:latest
)

echo Build completed successfully!
echo Image: %REGISTRY%/payment-microservice:%VERSION%