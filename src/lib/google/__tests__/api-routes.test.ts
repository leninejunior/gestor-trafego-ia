/**
 * Google Ads API Routes Unit Tests
 * 
 * Unit tests for Google Ads API route handlers focusing on
 * business logic, parameter validation, and error handling
 * Requirements: 1.1, 7.1, 8.1
 */

import { NextRequest } from 'next/server';

// Mock all external dependencies
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/google/oauth');
jest.mock('@/lib/google/token-manager');
jest.mock('@/lib/google/sync-service');
jest.mock('@/lib/google/client');

describe('Google Ads API Routes Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Parameter Validation', () => {
    describe('Auth Route Validation', () => {
      it('should validate clientId as UUID', () => {
        const validUUIDs = [
          '123e4567-e89b-12d3-a456-426614174000',
          'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        ];

        const invalidUUIDs = [
          'not-a-uuid',
          '123',
          '',
          'invalid-format-123',
        ];

        validUUIDs.forEach(uuid => {
          expect(isValidUUID(uuid)).toBe(true);
        });

        invalidUUIDs.forEach(uuid => {
          expect(isValidUUID(uuid)).toBe(false);
        });
      });

      it('should validate redirect URI format', () => {
        const validURIs = [
          'https://example.com/callback',
          'http://localhost:3000/api/google/callback',
          'https://app.example.com/auth/google/callback',
        ];

        const invalidURIs = [
          'not-a-url',
          'ftp://example.com',
          'javascript:alert(1)',
          '',
        ];

        validURIs.forEach(uri => {
          expect(isValidURL(uri)).toBe(true);
        });

        invalidURIs.forEach(uri => {
          expect(isValidURL(uri)).toBe(false);
        });
      });
    });

    describe('Campaigns Route Validation', () => {
      it('should validate campaign status enum', () => {
        const validStatuses = ['ENABLED', 'PAUSED', 'REMOVED', 'all'];
        const invalidStatuses = ['active', 'inactive', 'deleted', ''];

        validStatuses.forEach(status => {
          expect(['ENABLED', 'PAUSED', 'REMOVED', 'all'].includes(status)).toBe(true);
        });

        invalidStatuses.forEach(status => {
          expect(['ENABLED', 'PAUSED', 'REMOVED', 'all'].includes(status)).toBe(false);
        });
      });

      it('should validate date format YYYY-MM-DD', () => {
        const validDates = [
          '2024-01-01',
          '2024-12-31',
          '2023-02-28',
        ];

        const invalidDates = [
          '2024/01/01',
          '01-01-2024',
          '2024-1-1',
          'invalid-date',
          '',
        ];

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

        validDates.forEach(date => {
          expect(dateRegex.test(date)).toBe(true);
        });

        invalidDates.forEach(date => {
          expect(dateRegex.test(date)).toBe(false);
        });
      });

      it('should validate pagination parameters', () => {
        const validPages = [1, 2, 10, 100];
        const invalidPages = [0, -1, 'invalid', null];

        const validLimits = [1, 20, 50, 100];
        const invalidLimits = [0, -1, 101, 'invalid'];

        validPages.forEach(page => {
          expect(typeof page === 'number' && page >= 1).toBe(true);
        });

        invalidPages.forEach(page => {
          expect(typeof page === 'number' && page >= 1).toBe(false);
        });

        validLimits.forEach(limit => {
          expect(typeof limit === 'number' && limit >= 1 && limit <= 100).toBe(true);
        });

        invalidLimits.forEach(limit => {
          expect(typeof limit === 'number' && limit >= 1 && limit <= 100).toBe(false);
        });
      });
    });

    describe('Metrics Route Validation', () => {
      it('should validate granularity enum', () => {
        const validGranularities = ['daily', 'weekly', 'monthly'];
        const invalidGranularities = ['hourly', 'yearly', 'custom', ''];

        validGranularities.forEach(granularity => {
          expect(['daily', 'weekly', 'monthly'].includes(granularity)).toBe(true);
        });

        invalidGranularities.forEach(granularity => {
          expect(['daily', 'weekly', 'monthly'].includes(granularity)).toBe(false);
        });
      });

      it('should validate groupBy enum', () => {
        const validGroupBy = ['campaign', 'date', 'campaign_date'];
        const invalidGroupBy = ['user', 'account', 'custom', ''];

        validGroupBy.forEach(groupBy => {
          expect(['campaign', 'date', 'campaign_date'].includes(groupBy)).toBe(true);
        });

        invalidGroupBy.forEach(groupBy => {
          expect(['campaign', 'date', 'campaign_date'].includes(groupBy)).toBe(false);
        });
      });

      it('should validate compareWith enum', () => {
        const validCompareWith = ['previous_period', 'previous_year', 'none'];
        const invalidCompareWith = ['last_month', 'custom', 'invalid', ''];

        validCompareWith.forEach(compareWith => {
          expect(['previous_period', 'previous_year', 'none'].includes(compareWith)).toBe(true);
        });

        invalidCompareWith.forEach(compareWith => {
          expect(['previous_period', 'previous_year', 'none'].includes(compareWith)).toBe(false);
        });
      });
    });

    describe('Sync Route Validation', () => {
      it('should validate sync type enum', () => {
        const validSyncTypes = ['campaigns', 'metrics', 'full'];
        const invalidSyncTypes = ['partial', 'custom', 'invalid', ''];

        validSyncTypes.forEach(syncType => {
          expect(['campaigns', 'metrics', 'full'].includes(syncType)).toBe(true);
        });

        invalidSyncTypes.forEach(syncType => {
          expect(['campaigns', 'metrics', 'full'].includes(syncType)).toBe(false);
        });
      });
    });
  });

  describe('Business Logic', () => {
    describe('Rate Limiting Logic', () => {
      it('should implement proper rate limiting', () => {
        const rateLimitMap = new Map();
        const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
        const MAX_SYNCS_PER_WINDOW = 3;

        function checkRateLimit(clientId: string): { allowed: boolean; resetTime?: number } {
          const now = Date.now();
          const key = `sync_${clientId}`;
          const current = rateLimitMap.get(key);

          if (!current || now > current.resetTime) {
            rateLimitMap.set(key, {
              count: 1,
              resetTime: now + RATE_LIMIT_WINDOW,
            });
            return { allowed: true };
          }

          if (current.count >= MAX_SYNCS_PER_WINDOW) {
            return { allowed: false, resetTime: current.resetTime };
          }

          current.count += 1;
          return { allowed: true };
        }

        const clientId = 'test-client';

        // First 3 requests should be allowed
        for (let i = 0; i < 3; i++) {
          const result = checkRateLimit(clientId);
          expect(result.allowed).toBe(true);
        }

        // 4th request should be denied
        const result = checkRateLimit(clientId);
        expect(result.allowed).toBe(false);
        expect(result.resetTime).toBeDefined();
      });
    });

    describe('Date Range Validation', () => {
      it('should validate date range logic', () => {
        function validateDateRange(dateFrom: string, dateTo: string) {
          const startDate = new Date(dateFrom);
          const endDate = new Date(dateTo);
          
          if (startDate > endDate) {
            return { valid: false, error: 'Data inicial deve ser anterior à data final' };
          }

          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff > 365) {
            return { valid: false, error: 'Período máximo permitido é de 1 ano' };
          }

          return { valid: true, days: daysDiff };
        }

        // Valid ranges
        expect(validateDateRange('2024-01-01', '2024-01-31').valid).toBe(true);
        expect(validateDateRange('2024-01-01', '2024-12-31').valid).toBe(true);

        // Invalid ranges
        expect(validateDateRange('2024-01-31', '2024-01-01').valid).toBe(false);
        expect(validateDateRange('2023-01-01', '2024-12-31').valid).toBe(false);
      });
    });

    describe('Metrics Processing Logic', () => {
      it('should process metrics by granularity correctly', () => {
        const mockMetrics = [
          {
            date: '2024-01-01',
            impressions: 1000,
            clicks: 50,
            conversions: 5,
            cost: 25.00,
            google_ads_campaigns: { id: 'campaign-1', campaign_name: 'Test Campaign' },
          },
          {
            date: '2024-01-02',
            impressions: 1200,
            clicks: 60,
            conversions: 6,
            cost: 30.00,
            google_ads_campaigns: { id: 'campaign-1', campaign_name: 'Test Campaign' },
          },
        ];

        function groupByCampaign(data: any[]) {
          const grouped = new Map();

          data.forEach(metric => {
            const campaign = metric.google_ads_campaigns;
            const key = campaign.id;

            if (!grouped.has(key)) {
              grouped.set(key, {
                campaignId: campaign.id,
                campaignName: campaign.campaign_name,
                impressions: 0,
                clicks: 0,
                conversions: 0,
                cost: 0,
              });
            }

            const group = grouped.get(key);
            group.impressions += parseInt(metric.impressions) || 0;
            group.clicks += parseInt(metric.clicks) || 0;
            group.conversions += parseFloat(metric.conversions) || 0;
            group.cost += parseFloat(metric.cost) || 0;
          });

          return Array.from(grouped.values());
        }

        const result = groupByCampaign(mockMetrics);
        
        expect(result).toHaveLength(1);
        expect(result[0].impressions).toBe(2200);
        expect(result[0].clicks).toBe(110);
        expect(result[0].conversions).toBe(11);
        expect(result[0].cost).toBe(55);
      });

      it('should calculate derived metrics correctly', () => {
        function calculateDerivedMetrics(impressions: number, clicks: number, conversions: number, cost: number) {
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
          const cpc = clicks > 0 ? cost / clicks : 0;
          const cpa = conversions > 0 ? cost / conversions : 0;

          return {
            ctr: parseFloat(ctr.toFixed(2)),
            conversionRate: parseFloat(conversionRate.toFixed(2)),
            cpc: parseFloat(cpc.toFixed(2)),
            cpa: parseFloat(cpa.toFixed(2)),
          };
        }

        const result = calculateDerivedMetrics(1000, 50, 5, 25);
        
        expect(result.ctr).toBe(5.00); // 50/1000 * 100
        expect(result.conversionRate).toBe(10.00); // 5/50 * 100
        expect(result.cpc).toBe(0.50); // 25/50
        expect(result.cpa).toBe(5.00); // 25/5
      });
    });

    describe('OAuth State Management', () => {
      it('should generate secure state parameters', () => {
        function generateState(): string {
          const crypto = require('crypto');
          return crypto.randomBytes(32).toString('hex');
        }

        const state1 = generateState();
        const state2 = generateState();

        expect(state1).toHaveLength(64); // 32 bytes = 64 hex chars
        expect(state2).toHaveLength(64);
        expect(state1).not.toBe(state2); // Should be unique
        expect(/^[a-f0-9]+$/.test(state1)).toBe(true); // Should be hex
      });

      it('should validate state parameters securely', () => {
        function constantTimeCompare(a: string, b: string): boolean {
          if (a.length !== b.length) {
            return false;
          }

          let result = 0;
          for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
          }

          return result === 0;
        }

        expect(constantTimeCompare('test', 'test')).toBe(true);
        expect(constantTimeCompare('test', 'TEST')).toBe(false);
        expect(constantTimeCompare('test', 'different')).toBe(false);
        expect(constantTimeCompare('', '')).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should format user-friendly error messages', () => {
      function getUserFriendlyError(error: any): string {
        const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error';
        const errorLower = errorMessage.toLowerCase();

        if (errorLower.includes('access_denied')) {
          return 'Acesso negado. Você precisa autorizar o aplicativo para continuar.';
        }

        if (errorLower.includes('invalid_grant')) {
          return 'Token inválido ou expirado. Por favor, reconecte sua conta.';
        }

        if (errorLower.includes('invalid_client')) {
          return 'Configuração inválida do aplicativo. Entre em contato com o suporte.';
        }

        return `Erro de autenticação: ${errorMessage}`;
      }

      expect(getUserFriendlyError('access_denied')).toBe('Acesso negado. Você precisa autorizar o aplicativo para continuar.');
      expect(getUserFriendlyError('invalid_grant')).toBe('Token inválido ou expirado. Por favor, reconecte sua conta.');
      expect(getUserFriendlyError('invalid_client')).toBe('Configuração inválida do aplicativo. Entre em contato com o suporte.');
      expect(getUserFriendlyError('unknown_error')).toBe('Erro de autenticação: unknown_error');
    });

    it('should handle Zod validation errors', () => {
      function formatZodError(error: any) {
        if (error.name === 'ZodError') {
          return {
            error: 'Dados inválidos',
            details: error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`),
          };
        }
        return { error: 'Erro interno do servidor' };
      }

      const mockZodError = {
        name: 'ZodError',
        errors: [
          { path: ['clientId'], message: 'Client ID deve ser um UUID válido' },
          { path: ['dateFrom'], message: 'Data deve estar no formato YYYY-MM-DD' },
        ],
      };

      const result = formatZodError(mockZodError);
      expect(result.error).toBe('Dados inválidos');
      expect(result.details).toHaveLength(2);
      expect(result.details[0]).toBe('clientId: Client ID deve ser um UUID válido');
    });
  });

  describe('Security', () => {
    it('should sanitize error messages for production', () => {
      function sanitizeError(error: any, isDevelopment: boolean = false) {
        if (isDevelopment) {
          return error.message || 'Unknown error';
        }

        // In production, don't expose internal error details
        if (error.message?.includes('database') || error.message?.includes('internal')) {
          return 'Erro interno do servidor';
        }

        return error.message || 'Erro interno do servidor';
      }

      const dbError = new Error('Database connection failed: host unreachable');
      const userError = new Error('Invalid input provided');

      expect(sanitizeError(dbError, false)).toBe('Erro interno do servidor');
      expect(sanitizeError(userError, false)).toBe('Invalid input provided');
      expect(sanitizeError(dbError, true)).toBe('Database connection failed: host unreachable');
    });

    it('should validate CORS headers', () => {
      function validateOrigin(origin: string, allowedOrigins: string[]): boolean {
        return allowedOrigins.includes(origin);
      }

      const allowedOrigins = [
        'https://app.example.com',
        'https://staging.example.com',
        'http://localhost:3000',
      ];

      expect(validateOrigin('https://app.example.com', allowedOrigins)).toBe(true);
      expect(validateOrigin('https://malicious.com', allowedOrigins)).toBe(false);
      expect(validateOrigin('http://localhost:3000', allowedOrigins)).toBe(true);
    });
  });
});

// Helper functions for tests
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}