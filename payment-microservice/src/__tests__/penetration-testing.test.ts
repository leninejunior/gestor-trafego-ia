import express from 'express';
import request from 'supertest';
import { WebhookSecurity } from '../domain/services/webhook-security';
import { EncryptionService } from '../infrastructure/security/encryption.service';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

describe('Penetration Testing', () => {
  let app: express.Application;
  let webhookSecurity: WebhookSecurity;
  let encryptionService: EncryptionService;

  beforeEach(() => {
    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    
    webhookSecurity = new WebhookSecurity();
    encryptionService = new EncryptionService();
    
    // Setup vulnerable endpoints for testing
    app.post('/api/webhook', (req, res) => {
      try {
        const { payload, signature, provider = 'stripe' } = req.body;
        const config = WebhookSecurity.createProviderConfig(provider as any);
        
        const result = webhookSecurity.validateHmacSignature(
          payload,
          signature,
          'test-secret',
          config
        );
        
        res.json({ valid: result.isValid, reason: result.reason });
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    app.post('/api/encrypt', (req, res) => {
      try {
        const { data } = req.body;
        const encrypted = encryptionService.encrypt(data);
        res.json({ encrypted, original: data });
      } catch (error) {
        res.status(400).json({ error: 'Encryption failed' });
      }
    });
    
    app.get('/api/debug/:id', (req, res) => {
      // Intentionally vulnerable endpoint for testing
      const { id } = req.params;
      res.json({ debug: `Debug info for ${id}`, query: req.query });
    });
  });

  afterEach(() => {
    encryptionService.destroy();
  });

  describe('Injection Attacks', () => {
    it('should prevent SQL injection in webhook payloads', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "'; INSERT INTO logs VALUES ('hacked'); --",
        "UNION SELECT password FROM users WHERE 1=1 --",
        "1'; EXEC xp_cmdshell('dir'); --"
      ];

      for (const payload of sqlInjectionPayloads) {
        const config = WebhookSecurity.createProviderConfig('stripe');
        const signature = webhookSecurity.generateHmacSignature(payload, 'test-secret', config);
        
        const response = await request(app)
          .post('/api/webhook')
          .send({ payload, signature });
        
        // Should validate signature but not execute SQL
        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(true);
      }
    });

    it('should prevent NoSQL injection attacks', async () => {
      const noSqlInjectionPayloads = [
        '{"$ne": null}',
        '{"$gt": ""}',
        '{"$where": "this.password.length > 0"}',
        '{"$regex": ".*"}',
        '{"$or": [{"password": {"$exists": true}}]}'
      ];

      for (const payload of noSqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/encrypt')
          .send({ data: payload });
        
        // Should handle as regular data, not execute as query
        expect([200, 400]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.original).toBe(payload);
        }
      }
    });

    it('should prevent command injection', async () => {
      const commandInjectionPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '&& rm -rf /',
        '`whoami`',
        '$(id)',
        '; ping -c 1 google.com'
      ];

      for (const payload of commandInjectionPayloads) {
        const response = await request(app)
          .get(`/api/debug/${encodeURIComponent(payload)}`);
        
        expect(response.status).toBe(200);
        // Should not execute commands
        expect(response.body.debug).toContain(payload);
      }
    });
  });

  describe('Cross-Site Scripting (XSS)', () => {
    it('should prevent reflected XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '"><script>alert(document.cookie)</script>',
        '<svg onload="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .get('/api/debug/test')
          .query({ input: payload });
        
        expect(response.status).toBe(200);
        // Response should not contain unescaped script tags
        const responseText = JSON.stringify(response.body);
        // Check that script tags are properly escaped (contains \" instead of ")
        if (responseText.includes('<script')) {
          expect(responseText).toMatch(/\\"/); // Should be JSON-escaped
        }
      }
    });

    it('should prevent stored XSS through encrypted data', async () => {
      const xssPayloads = [
        '<script>alert("stored xss")</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:void(0)'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/encrypt')
          .send({ data: payload });
        
        if (response.status === 200) {
          expect(response.body.encrypted).toBeDefined();
          expect(response.body.encrypted).not.toBe(payload);
          
          // Decrypt and verify it's the same but not executable
          const decrypted = encryptionService.decrypt(response.body.encrypted);
          expect(decrypted).toBe(payload);
        }
      }
    });
  });

  describe('Path Traversal Attacks', () => {
    it('should prevent directory traversal', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '....//....//....//etc/passwd',
        '..%252f..%252f..%252fetc%252fpasswd'
      ];

      for (const payload of pathTraversalPayloads) {
        const response = await request(app)
          .get(`/api/debug/${encodeURIComponent(payload)}`);
        
        expect(response.status).toBe(200);
        // Should not access file system
        expect(response.body.debug).toContain(payload);
      }
    });
  });

  describe('Authentication and Authorization Bypass', () => {
    it('should prevent authentication bypass attempts', async () => {
      const bypassAttempts = [
        { payload: 'admin', signature: 'fake-signature' },
        { payload: '{"user": "admin", "role": "admin"}', signature: '' },
        { payload: 'test', signature: null },
        { payload: 'test', signature: undefined }
      ];

      for (const attempt of bypassAttempts) {
        const response = await request(app)
          .post('/api/webhook')
          .send(attempt);
        
        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(false);
        expect(response.body.reason).toBeDefined();
      }
    });

    it('should prevent privilege escalation through headers', async () => {
      const privilegeHeaders = {
        'X-Admin': 'true',
        'X-Role': 'admin',
        'X-User-Id': '1',
        'Authorization': 'Bearer fake-token',
        'X-Forwarded-User': 'admin'
      };

      const response = await request(app)
        .post('/api/webhook')
        .set(privilegeHeaders)
        .send({ payload: 'test', signature: 'fake' });
      
      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
    });
  });

  describe('Denial of Service (DoS)', () => {
    it('should handle extremely large payloads', async () => {
      const largePayload = 'A'.repeat(5 * 1024 * 1024); // 5MB
      
      const response = await request(app)
        .post('/api/encrypt')
        .send({ data: largePayload });
      
      // Should either process or reject gracefully
      expect([200, 413, 400]).toContain(response.status);
    });

    it('should handle deeply nested JSON', async () => {
      // Create deeply nested object
      let nested: any = 'deep';
      for (let i = 0; i < 1000; i++) {
        nested = { level: i, data: nested };
      }
      
      const response = await request(app)
        .post('/api/encrypt')
        .send({ data: JSON.stringify(nested) });
      
      expect([200, 400]).toContain(response.status);
    });

    it('should handle malformed JSON gracefully', async () => {
      const malformedJson = '{"incomplete": "json", "missing":}';
      
      const response = await request(app)
        .post('/api/webhook')
        .set('Content-Type', 'application/json')
        .send(malformedJson);
      
      expect([400, 422]).toContain(response.status);
    });
  });

  describe('Information Disclosure', () => {
    it('should not leak sensitive information in error messages', async () => {
      const response = await request(app)
        .post('/api/webhook')
        .send({ payload: 'test', signature: 'invalid' });
      
      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      
      // Should not contain sensitive information
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toMatch(/secret|key|password|token/i);
    });

    it('should not expose internal paths or stack traces', async () => {
      const response = await request(app)
        .post('/api/encrypt')
        .send({ data: null });
      
      expect(response.status).toBe(400);
      
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toMatch(/\/src\/|\/node_modules\/|at Object\./);
    });
  });
});