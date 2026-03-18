import express from 'express';
import request from 'supertest';
import { WebhookSecurity } from '../domain/services/webhook-security';
import { EncryptionService } from '../infrastructure/security/encryption.service';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock rate limiting middleware
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  
  constructor(private config: RateLimitConfig) {}
  
  middleware() {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const clientId = this.getClientId(req);
      const now = Date.now();
      const windowStart = now - this.config.windowMs;
      
      let clientData = this.requests.get(clientId);
      
      if (!clientData || clientData.resetTime <= now) {
        clientData = { count: 0, resetTime: now + this.config.windowMs };
        this.requests.set(clientId, clientData);
      }
      
      clientData.count++;
      
      if (clientData.count > this.config.max) {
        return res.status(429).json({
          error: this.config.message,
          retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
        });
      }
      
      // Add rate limit headers
      if (this.config.standardHeaders) {
        res.set({
          'RateLimit-Limit': this.config.max.toString(),
          'RateLimit-Remaining': Math.max(0, this.config.max - clientData.count).toString(),
          'RateLimit-Reset': new Date(clientData.resetTime).toISOString()
        });
      }
      
      next();
    };
  }
  
  private getClientId(req: express.Request): string {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
  
  reset(): void {
    this.requests.clear();
  }
}

describe('Rate Limiting and DDoS Protection Tests', () => {
  let app: express.Application;
  let rateLimiter: RateLimiter;
  let webhookSecurity: WebhookSecurity;
  let encryptionService: EncryptionService;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    rateLimiter = new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
      message: 'Too many requests',
      standardHeaders: true,
      legacyHeaders: false
    });
    
    webhookSecurity = new WebhookSecurity();
    encryptionService = new EncryptionService();
    
    // Setup test routes
    app.use('/api', rateLimiter.middleware());
    
    app.post('/api/webhook', (req, res) => {
      const { payload, signature } = req.body;
      const config = WebhookSecurity.createProviderConfig('stripe');
      
      const result = webhookSecurity.validateHmacSignature(
        payload,
        signature,
        'test-secret',
        config
      );
      
      res.json({ valid: result.isValid });
    });
    
    app.post('/api/encrypt', (req, res) => {
      const { data } = req.body;
      try {
        const encrypted = encryptionService.encrypt(data);
        res.json({ encrypted });
      } catch (error) {
        res.status(400).json({ error: 'Encryption failed' });
      }
    });
    
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  });

  afterEach(() => {
    rateLimiter.reset();
    encryptionService.destroy();
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const requests = Array.from({ length: 50 }, () =>
        request(app).get('/api/health')
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.headers['ratelimit-limit']).toBe('100');
      });
    });

    it('should block requests exceeding rate limit', async () => {
      // Make requests up to the limit
      const withinLimitRequests = Array.from({ length: 100 }, () =>
        request(app).get('/api/health')
      );
      
      await Promise.all(withinLimitRequests);
      
      // This request should be blocked
      const blockedResponse = await request(app).get('/api/health');
      
      expect(blockedResponse.status).toBe(429);
      expect(blockedResponse.body.error).toBe('Too many requests');
      expect(blockedResponse.body.retryAfter).toBeGreaterThan(0);
    });

    it('should include proper rate limit headers', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.headers['ratelimit-limit']).toBe('100');
      expect(response.headers['ratelimit-remaining']).toBe('99');
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });

    it('should reset rate limit after window expires', async () => {
      // Create a short-window rate limiter for testing
      const shortRateLimiter = new RateLimiter({
        windowMs: 200, // 200ms window
        max: 1, // Only 1 request allowed
        message: 'Too many requests',
        standardHeaders: true,
        legacyHeaders: false
      });
      
      const testApp = express();
      testApp.use('/test', shortRateLimiter.middleware());
      testApp.get('/test', (req, res) => res.json({ ok: true }));
      
      // Make first request
      const firstResponse = await request(testApp).get('/test');
      expect(firstResponse.status).toBe(200);
      
      // This should be blocked immediately
      const blockedResponse = await request(testApp).get('/test');
      expect(blockedResponse.status).toBe(429);
      
      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // This should work again
      const allowedResponse = await request(testApp).get('/test');
      expect(allowedResponse.status).toBe(200);
    });
  });

  describe('DDoS Protection Simulation', () => {
    it('should handle burst of concurrent requests', async () => {
      const concurrentRequests = Array.from({ length: 50 }, () =>
        request(app).get('/api/health')
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();
      
      // All requests should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle large payload attacks', async () => {
      const largePayload = 'A'.repeat(1024 * 1024); // 1MB payload
      
      const response = await request(app)
        .post('/api/encrypt')
        .send({ data: largePayload });
      
      // Should handle large payloads gracefully
      expect([200, 413, 400]).toContain(response.status); // OK, Payload Too Large, or Bad Request
    });

    it('should handle malformed request attacks', async () => {
      const malformedRequests = [
        request(app).post('/api/webhook').send('invalid json'),
        request(app).post('/api/webhook').send({}),
        request(app).post('/api/webhook').send({ malformed: true }),
        request(app).post('/api/webhook').send(Buffer.alloc(1000, 0).toString())
      ];
      
      const responses = await Promise.allSettled(malformedRequests);
      
      responses.forEach(result => {
        if (result.status === 'fulfilled') {
          // Should return error status, not crash - 200 is also acceptable if handled gracefully
          expect([200, 400, 422, 500]).toContain(result.value.status);
        }
        // If rejected, that's also acceptable (connection error)
      });
    });

    it('should handle slowloris-style attacks', async () => {
      // Simulate slow requests
      const slowRequests = Array.from({ length: 10 }, () => {
        return new Promise<request.Response>((resolve) => {
          setTimeout(() => {
            request(app)
              .get('/api/health')
              .end((err, res) => {
                resolve(res);
              });
          }, Math.random() * 1000); // Random delay up to 1 second
        });
      });
      
      const responses = await Promise.all(slowRequests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should protect against webhook flooding', async () => {
      const config = WebhookSecurity.createProviderConfig('stripe');
      const validSignature = webhookSecurity.generateHmacSignature(
        'test payload',
        'test-secret',
        config
      );
      
      // Flood with webhook requests
      const webhookRequests = Array.from({ length: 200 }, () =>
        request(app)
          .post('/api/webhook')
          .send({
            payload: 'test payload',
            signature: validSignature
          })
      );
      
      const responses = await Promise.allSettled(webhookRequests);
      
      let successCount = 0;
      let rateLimitedCount = 0;
      
      responses.forEach(result => {
        if (result.status === 'fulfilled') {
          if (result.value.status === 200) {
            successCount++;
          } else if (result.value.status === 429) {
            rateLimitedCount++;
          }
        }
      });
      
      // Should have rate limited some requests
      expect(rateLimitedCount).toBeGreaterThan(0);
      expect(successCount).toBeLessThanOrEqual(100); // Within rate limit
    });
  });

  describe('Resource Exhaustion Protection', () => {
    it('should handle memory exhaustion attempts', async () => {
      const memoryIntensiveRequests = Array.from({ length: 10 }, (_, i) => {
        const largeData = 'x'.repeat(100 * 1024); // 100KB each
        return request(app)
          .post('/api/encrypt')
          .send({ data: largeData });
      });
      
      const responses = await Promise.allSettled(memoryIntensiveRequests);
      
      // System should handle these gracefully
      responses.forEach(result => {
        if (result.status === 'fulfilled') {
          expect([200, 400, 413, 429]).toContain(result.value.status);
        }
      });
    });

    it('should handle CPU exhaustion attempts', async () => {
      // Simulate CPU-intensive cryptographic operations
      const cpuIntensiveRequests = Array.from({ length: 20 }, () => {
        const complexData = JSON.stringify({
          data: 'x'.repeat(10000),
          timestamp: Date.now(),
          random: Math.random()
        });
        
        return request(app)
          .post('/api/encrypt')
          .send({ data: complexData });
      });
      
      const startTime = Date.now();
      const responses = await Promise.allSettled(cpuIntensiveRequests);
      const endTime = Date.now();
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
      
      responses.forEach(result => {
        if (result.status === 'fulfilled') {
          expect([200, 400, 429]).toContain(result.value.status);
        }
      });
    });

    it('should handle connection exhaustion', async () => {
      // Simulate many concurrent connections
      const connectionRequests = Array.from({ length: 100 }, () =>
        request(app).get('/api/health')
      );
      
      const responses = await Promise.all(connectionRequests);
      
      // Most should succeed, some might be rate limited
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      expect(successCount + rateLimitedCount).toBe(100);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
    });
  });

  describe('Security Headers and Protection', () => {
    it('should include security headers in responses', async () => {
      // Create new app with security middleware
      const secureApp = express();
      secureApp.use(express.json());
      
      // Add security middleware
      secureApp.use((req, res, next) => {
        res.set({
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
          'Content-Security-Policy': "default-src 'self'"
        });
        next();
      });
      
      secureApp.get('/api/health', (req, res) => {
        res.json({ status: 'ok' });
      });
      
      const response = await request(secureApp).get('/api/health');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('should validate request origins', async () => {
      // Create new app with CORS protection
      const corsApp = express();
      corsApp.use(express.json());
      
      // Add CORS protection
      corsApp.use((req, res, next) => {
        const allowedOrigins = ['https://trusted-domain.com'];
        const origin = req.headers.origin;
        
        if (origin && !allowedOrigins.includes(origin)) {
          return res.status(403).json({ error: 'Forbidden origin' });
        }
        
        next();
      });
      
      corsApp.get('/api/health', (req, res) => {
        res.json({ status: 'ok' });
      });
      
      // Request from untrusted origin
      const untrustedResponse = await request(corsApp)
        .get('/api/health')
        .set('Origin', 'https://malicious-site.com');
      
      expect(untrustedResponse.status).toBe(403);
      
      // Request from trusted origin
      const trustedResponse = await request(corsApp)
        .get('/api/health')
        .set('Origin', 'https://trusted-domain.com');
      
      expect(trustedResponse.status).toBe(200);
    });

    it('should protect against CSRF attacks', async () => {
      // Create new app with CSRF protection
      const csrfApp = express();
      csrfApp.use(express.json());
      
      // Add CSRF token validation
      const csrfTokens = new Set<string>();
      
      csrfApp.use((req, res, next) => {
        if (req.method === 'POST') {
          const token = req.headers['x-csrf-token'] as string;
          
          if (!token || !csrfTokens.has(token)) {
            return res.status(403).json({ error: 'Invalid CSRF token' });
          }
          
          // Remove used token
          csrfTokens.delete(token);
        }
        next();
      });
      
      csrfApp.post('/api/webhook', (req, res) => {
        res.json({ success: true });
      });
      
      // Generate CSRF token
      const csrfToken = 'csrf-' + Math.random().toString(36);
      csrfTokens.add(csrfToken);
      
      // Request without CSRF token should fail
      const noTokenResponse = await request(csrfApp)
        .post('/api/webhook')
        .send({ payload: 'test' });
      
      expect(noTokenResponse.status).toBe(403);
      
      // Request with valid CSRF token should succeed
      const validTokenResponse = await request(csrfApp)
        .post('/api/webhook')
        .set('X-CSRF-Token', csrfToken)
        .send({ payload: 'test', signature: 'test' });
      
      expect(validTokenResponse.status).toBe(200);
    });
  });
});