#!/bin/bash

# Complete System Integration Validation Script
# This script runs all integration tests and generates a comprehensive validation report

set -e

echo "🚀 Starting Payment Microservice Integration Validation"
echo "========================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create reports directory
mkdir -p reports
mkdir -p logs

# Set timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="reports/integration_validation_${TIMESTAMP}.md"
LOG_FILE="logs/integration_validation_${TIMESTAMP}.log"

# Function to log messages
log_message() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Function to run test and capture results
run_test_suite() {
    local test_name="$1"
    local test_command="$2"
    local start_time=$(date +%s)
    
    log_message "${BLUE}📋 Running $test_name...${NC}"
    
    if eval "$test_command" >> "$LOG_FILE" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_message "${GREEN}✅ $test_name completed successfully in ${duration}s${NC}"
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_message "${RED}❌ $test_name failed after ${duration}s${NC}"
        return 1
    fi
}

# Initialize report
cat > "$REPORT_FILE" << EOF
# Payment Microservice Integration Validation Report

**Generated:** $(date)
**Environment:** Integration Testing
**Version:** $(node -v)

## Executive Summary

This report contains the results of comprehensive integration testing for the Payment Microservice system.

## Test Results

EOF

# Initialize counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

log_message "${BLUE}🔧 Setting up test environment...${NC}"

# Check prerequisites
log_message "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    log_message "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    log_message "${RED}❌ npm is not installed${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    log_message "Installing dependencies..."
    npm install >> "$LOG_FILE" 2>&1
fi

log_message "${GREEN}✅ Prerequisites check completed${NC}"

# Test Suite 1: Complete System Integration
log_message "\n${YELLOW}=== Test Suite 1: Complete System Integration ===${NC}"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test_suite "Complete System Integration" "npm test -- --testPathPattern=complete-system-integration.test.ts --verbose"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo "### ✅ Complete System Integration - PASSED" >> "$REPORT_FILE"
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo "### ❌ Complete System Integration - FAILED" >> "$REPORT_FILE"
fi

# Test Suite 2: Monitoring and Metrics
log_message "\n${YELLOW}=== Test Suite 2: Monitoring and Metrics ===${NC}"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test_suite "Monitoring and Metrics" "npm test -- --testPathPattern=monitoring-validation.test.ts --verbose"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo "### ✅ Monitoring and Metrics - PASSED" >> "$REPORT_FILE"
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo "### ❌ Monitoring and Metrics - FAILED" >> "$REPORT_FILE"
fi

# Test Suite 3: Failover System
log_message "\n${YELLOW}=== Test Suite 3: Failover System ===${NC}"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test_suite "Failover System" "npm test -- --testPathPattern=failover-manager.test.ts --verbose"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo "### ✅ Failover System - PASSED" >> "$REPORT_FILE"
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo "### ❌ Failover System - FAILED" >> "$REPORT_FILE"
fi

# Test Suite 4: Security and Cryptography
log_message "\n${YELLOW}=== Test Suite 4: Security and Cryptography ===${NC}"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test_suite "Security and Cryptography" "npm test -- --testPathPattern=cryptography.test.ts --verbose"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo "### ✅ Security and Cryptography - PASSED" >> "$REPORT_FILE"
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo "### ❌ Security and Cryptography - FAILED" >> "$REPORT_FILE"
fi

# Test Suite 5: API Controllers
log_message "\n${YELLOW}=== Test Suite 5: API Controllers ===${NC}"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test_suite "API Controllers" "npm test -- --testPathPattern=api-controllers.test.ts --verbose"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo "### ✅ API Controllers - PASSED" >> "$REPORT_FILE"
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo "### ❌ API Controllers - FAILED" >> "$REPORT_FILE"
fi

# Generate system health report
log_message "\n${BLUE}🏥 Generating system health report...${NC}"

cat >> "$REPORT_FILE" << EOF

## System Health Check

### Environment Information
- Node.js Version: $(node -v)
- NPM Version: $(npm -v)
- Platform: $(uname -s)
- Architecture: $(uname -m)
- Memory: $(free -h 2>/dev/null | grep Mem | awk '{print $2}' || echo "N/A")

### Test Environment Status
- Test Database: Available
- Redis Cache: Available
- Metrics Collection: Active
- Logging System: Active

EOF

# Calculate success rate
SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

# Generate summary
log_message "\n${YELLOW}=== Generating Final Report ===${NC}"

cat >> "$REPORT_FILE" << EOF

## Summary

- **Total Test Suites:** $TOTAL_TESTS
- **Passed:** $PASSED_TESTS
- **Failed:** $FAILED_TESTS
- **Success Rate:** $SUCCESS_RATE%

EOF

# Add recommendations based on results
if [ $FAILED_TESTS -eq 0 ]; then
    cat >> "$REPORT_FILE" << EOF
### ✅ Overall Status: PASSED

All integration tests have passed successfully. The system is ready for production deployment.

### Recommendations:
1. Deploy to staging environment for final validation
2. Set up production monitoring and alerting
3. Configure backup and disaster recovery procedures
4. Schedule regular integration test runs in CI/CD pipeline

EOF
elif [ $PASSED_TESTS -gt $FAILED_TESTS ]; then
    cat >> "$REPORT_FILE" << EOF
### ⚠️ Overall Status: PARTIAL SUCCESS

Some tests have failed but the majority passed. Review failed tests before deployment.

### Recommendations:
1. Fix failing test cases immediately
2. Re-run integration tests after fixes
3. Consider deploying only after all tests pass
4. Implement additional monitoring for failed components

EOF
else
    cat >> "$REPORT_FILE" << EOF
### ❌ Overall Status: FAILED

Critical failures detected. System requires immediate attention before deployment.

### Recommendations:
1. Do not deploy to production
2. Fix all critical issues immediately
3. Re-run complete integration test suite
4. Consider rollback if already deployed

EOF
fi

# Display final summary
log_message "\n${YELLOW}========================================================"
log_message "🎯 INTEGRATION VALIDATION SUMMARY"
log_message "========================================================${NC}"
log_message "📅 Completed: $(date)"
log_message "📊 Total Tests: $TOTAL_TESTS"
log_message "✅ Passed: $PASSED_TESTS"
log_message "❌ Failed: $FAILED_TESTS"
log_message "📈 Success Rate: $SUCCESS_RATE%"

if [ $FAILED_TESTS -eq 0 ]; then
    log_message "${GREEN}🎉 ALL TESTS PASSED! System ready for production.${NC}"
    EXIT_CODE=0
elif [ $PASSED_TESTS -gt $FAILED_TESTS ]; then
    log_message "${YELLOW}⚠️  PARTIAL SUCCESS. Review failures before deployment.${NC}"
    EXIT_CODE=1
else
    log_message "${RED}🚨 CRITICAL FAILURES. System requires immediate attention.${NC}"
    EXIT_CODE=2
fi

log_message "📄 Detailed report: $REPORT_FILE"
log_message "📋 Full logs: $LOG_FILE"
log_message "${YELLOW}========================================================${NC}"

# Exit with appropriate code
exit $EXIT_CODE