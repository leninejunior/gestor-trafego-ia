@echo off
REM Security Test Runner Script for Windows
REM This script runs all security-related tests for the payment microservice

echo 🔒 Running Security Tests for Payment Microservice
echo ==================================================

REM Set test timeout to handle long-running security tests
set JEST_TIMEOUT=60000

echo.
echo 📋 Test Categories:
echo   - Penetration Testing (SQL injection, XSS, etc.)
echo   - Cryptography and Key Validation
echo   - Rate Limiting and DDoS Protection
echo   - Dependency Security Audit
echo.

REM Run security tests with detailed output
npm test -- --testPathPattern="security|rate-limiting|dependency-audit|penetration-testing" --verbose --testTimeout=60000 --coverage --coverageDirectory=coverage/security

REM Check exit code
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ All security tests passed!
    echo.
    echo 📊 Security Test Summary:
    echo   - Penetration tests: Validated against common attack vectors
    echo   - Cryptography tests: Verified encryption, key rotation, and HMAC validation
    echo   - Rate limiting tests: Confirmed DDoS protection and resource limits
    echo   - Dependency audit: Checked for vulnerable packages
    echo.
    echo 🛡️  Security compliance verified for requirements 6.1, 6.2, and 6.4
) else (
    echo.
    echo ❌ Some security tests failed!
    echo Please review the test output above and fix any issues.
    exit /b 1
)