/**
 * Organization Editing Error Scenarios Test Suite
 * 
 * This script tests all error scenarios for organization editing functionality
 * Run with: node src/tests/organization-editing-error-tests.js
 */

const https = require('https');
const http = require('http');

// Test configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const TEST_ORG_ID = 'test-org-id'; // This should be replaced with actual org ID for testing

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonBody
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test cases
const tests = [
  {
    name: 'Empty name validation',
    description: 'Should return 400 when name is empty',
    test: async () => {
      const url = new URL(`${BASE_URL}/api/organizations/${TEST_ORG_ID}`);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        }
      };
      
      const response = await makeRequest(options, { name: '' });
      
      return {
        passed: response.statusCode === 400 && 
                response.body.error && 
                response.body.error.includes('vazio'),
        statusCode: response.statusCode,
        error: response.body.error,
        expected: 'Status 400 with empty name error message'
      };
    }
  },
  
  {
    name: 'Null name validation',
    description: 'Should return 400 when name is null',
    test: async () => {
      const url = new URL(`${BASE_URL}/api/organizations/${TEST_ORG_ID}`);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        }
      };
      
      const response = await makeRequest(options, { name: null });
      
      return {
        passed: response.statusCode === 400 && 
                response.body.error && 
                response.body.error.includes('obrigatório'),
        statusCode: response.statusCode,
        error: response.body.error,
        expected: 'Status 400 with required name error message'
      };
    }
  },
  
  {
    name: 'Missing name field',
    description: 'Should return 400 when name field is missing',
    test: async () => {
      const url = new URL(`${BASE_URL}/api/organizations/${TEST_ORG_ID}`);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        }
      };
      
      const response = await makeRequest(options, {});
      
      return {
        passed: response.statusCode === 400 && 
                response.body.error && 
                response.body.error.includes('obrigatório'),
        statusCode: response.statusCode,
        error: response.body.error,
        expected: 'Status 400 with required name error message'
      };
    }
  },
  
  {
    name: 'Long name validation',
    description: 'Should return 400 when name exceeds 100 characters',
    test: async () => {
      const url = new URL(`${BASE_URL}/api/organizations/${TEST_ORG_ID}`);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        }
      };
      
      const longName = 'A'.repeat(101); // 101 characters
      const response = await makeRequest(options, { name: longName });
      
      return {
        passed: response.statusCode === 400 && 
                response.body.error && 
                response.body.error.includes('100 caracteres'),
        statusCode: response.statusCode,
        error: response.body.error,
        expected: 'Status 400 with max length error message'
      };
    }
  },
  
  {
    name: 'Invalid JSON format',
    description: 'Should return 400 when request body is invalid JSON',
    test: async () => {
      const url = new URL(`${BASE_URL}/api/organizations/${TEST_ORG_ID}`);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        }
      };
      
      return new Promise((resolve) => {
        const protocol = options.hostname === 'localhost' ? http : https;
        
        const req = protocol.request(options, (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          
          res.on('end', () => {
            try {
              const jsonBody = body ? JSON.parse(body) : {};
              resolve({
                passed: res.statusCode === 400 && 
                        jsonBody.error && 
                        jsonBody.error.includes('inválidos'),
                statusCode: res.statusCode,
                error: jsonBody.error,
                expected: 'Status 400 with invalid data error message'
              });
            } catch (e) {
              resolve({
                passed: res.statusCode === 400,
                statusCode: res.statusCode,
                error: body,
                expected: 'Status 400 with invalid data error message'
              });
            }
          });
        });
        
        req.on('error', () => {
          resolve({
            passed: false,
            statusCode: 'ERROR',
            error: 'Network error',
            expected: 'Status 400 with invalid data error message'
          });
        });
        
        // Send invalid JSON
        req.write('{ invalid json }');
        req.end();
      });
    }
  },
  
  {
    name: 'Unauthorized access',
    description: 'Should return 401 when no authentication token provided',
    test: async () => {
      const url = new URL(`${BASE_URL}/api/organizations/${TEST_ORG_ID}`);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          // No Authorization header
        }
      };
      
      const response = await makeRequest(options, { name: 'Test Organization' });
      
      return {
        passed: response.statusCode === 401 && 
                response.body.error && 
                response.body.error.includes('Unauthorized'),
        statusCode: response.statusCode,
        error: response.body.error,
        expected: 'Status 401 with Unauthorized error message'
      };
    }
  },
  
  {
    name: 'Non-existent organization',
    description: 'Should return 404 when organization does not exist',
    test: async () => {
      const url = new URL(`${BASE_URL}/api/organizations/non-existent-id`);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        }
      };
      
      const response = await makeRequest(options, { name: 'Test Organization' });
      
      return {
        passed: response.statusCode === 404 || 
                (response.statusCode === 500 && response.body.error && 
                 response.body.error.includes('não encontrada')),
        statusCode: response.statusCode,
        error: response.body.error,
        expected: 'Status 404 or 500 with not found error message'
      };
    }
  }
];

// Run all tests
async function runTests() {
  console.log('🧪 Running Organization Editing Error Scenarios Tests\n');
  console.log(`Base URL: ${BASE_URL}\n`);
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      console.log(`Description: ${test.description}`);
      
      const result = await test.test();
      
      if (result.passed) {
        console.log('✅ PASSED');
        passed++;
      } else {
        console.log('❌ FAILED');
        console.log(`   Expected: ${result.expected}`);
        console.log(`   Got: Status ${result.statusCode}, Error: ${result.error}`);
        failed++;
      }
      
      console.log(''); // Empty line for readability
    } catch (error) {
      console.log('❌ FAILED (Exception)');
      console.log(`   Error: ${error.message}`);
      failed++;
      console.log('');
    }
  }
  
  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All error scenario tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the implementation.');
  }
  
  return { passed, failed };
}

// Export for use in other scripts
module.exports = { runTests, tests };

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}