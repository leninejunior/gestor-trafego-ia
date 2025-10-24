import { AdminController } from '../infrastructure/controllers/admin.controller';
import { ProviderRegistry } from '../domain/services/provider-registry';
import { HealthChecker } from '../domain/services/health-checker';
import { AuditService } from '../domain/services/audit-service';
import { ReportService } from '../infrastructure/controllers/report.service';
import { AlertManager } from '../infrastructure/controllers/alert-manager';
import { AuthenticatedRequest } from '../infrastructure/middleware/auth.middleware';
import { Response } from 'express';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

describe('AdminController', () => {
  let adminController: AdminController;
  let mockProviderRegistry: jest.Mocked<ProviderRegistry>;
  let mockHealthChecker: jest.Mocked<HealthChecker>;
  let mockAuditService: jest.Mocked<AuditService>;
  let mockReportService: jest.Mocked<ReportService>;
  let mockAlertManager: jest.Mocked<AlertManager>;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    // Create mocks
    mockProviderRegistry = {
      getAllProviders: jest.fn().mockReturnValue([]),
    } as any;

    mockHealthChecker = {
      checkProvider: jest.fn().mockResolvedValue({
        status: 'healthy',
        responseTime: 100
      }),
    } as any;

    mockAuditService = {
      logAction: jest.fn().mockResolvedValue(undefined),
      getAuditLogs: jest.fn().mockResolvedValue([]),
    } as any;

    mockReportService = {
      generateFinancialReport: jest.fn().mockResolvedValue({
        summary: {
          totalTransactions: 100,
          totalAmount: 10000,
          successfulTransactions: 95,
          failedTransactions: 5,
          successRate: 95.0,
          averageTransactionAmount: 100,
          totalFees: 200
        },
        byProvider: [],
        byPeriod: [],
        byCurrency: [],
        topTransactions: []
      }),
    } as any;

    mockAlertManager = {
      getAlerts: jest.fn().mockResolvedValue([]),
      acknowledgeAlert: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Create controller instance
    adminController = new AdminController(
      mockProviderRegistry,
      mockHealthChecker,
      mockAuditService,
      mockReportService,
      mockAlertManager
    );

    // Setup request/response mocks
    mockRequest = {
      user: {
        id: 'user123',
        email: 'admin@test.com',
        role: 'super_admin',
        permissions: ['dashboard:read', 'providers:read', 'reports:read']
      },
      correlationId: 'test-correlation-id',
      query: {},
      params: {},
      body: {}
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('getDashboard', () => {
    it('should return dashboard data for authorized user', async () => {
      await adminController.getDashboard(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          overview: expect.any(Object),
          providers: expect.any(Array),
          metrics: expect.any(Object),
          recentTransactions: expect.any(Array),
          alerts: expect.any(Array),
          lastUpdated: expect.any(Date)
        }),
        correlationId: 'test-correlation-id'
      });
    });

    it('should deny access for user without dashboard:read permission', async () => {
      // Change role to 'viewer' and remove dashboard:read permission
      mockRequest.user!.role = 'viewer';
      mockRequest.user!.permissions = ['providers:read'];

      await adminController.getDashboard(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient permissions',
        correlationId: 'test-correlation-id'
      });
    });
  });

  describe('getProvidersAdmin', () => {
    it('should return detailed provider information', async () => {
      mockProviderRegistry.getAllProviders.mockReturnValue([
        { name: 'stripe', version: '1.0.0' }
      ] as any);

      await adminController.getProvidersAdmin(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            name: 'stripe',
            version: '1.0.0',
            status: 'healthy',
            responseTime: 100
          })
        ]),
        count: 1,
        correlationId: 'test-correlation-id'
      });
    });
  });

  describe('getFinancialReports', () => {
    it('should generate and return financial report', async () => {
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        groupBy: 'day'
      };

      await adminController.getFinancialReports(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockReportService.generateFinancialReport).toHaveBeenCalledWith({
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        groupBy: 'day',
        providers: undefined,
        organizationId: undefined
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          summary: expect.any(Object)
        }),
        correlationId: 'test-correlation-id'
      });
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert successfully', async () => {
      mockRequest.params = { id: 'alert123' };
      mockRequest.body = { note: 'Investigating issue' };

      await adminController.acknowledgeAlert(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockAlertManager.acknowledgeAlert).toHaveBeenCalledWith(
        'alert123',
        'user123',
        'Investigating issue'
      );

      expect(mockAuditService.logAction).toHaveBeenCalledWith({
        userId: 'user123',
        action: 'alert_acknowledged',
        resourceType: 'alert',
        resourceId: 'alert123',
        details: { note: 'Investigating issue' },
        timestamp: expect.any(Date)
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Alert acknowledged successfully',
        correlationId: 'test-correlation-id'
      });
    });

    it('should deny access for user without alerts:write permission', async () => {
      mockRequest.user!.role = 'viewer';
      mockRequest.user!.permissions = ['alerts:read'];
      mockRequest.params = { id: 'alert123' };

      await adminController.acknowledgeAlert(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient permissions',
        correlationId: 'test-correlation-id'
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should deny access when user is not authenticated', async () => {
      mockRequest.user = undefined;

      await adminController.getDashboard(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        correlationId: 'test-correlation-id'
      });
    });

    it('should allow super_admin to access all endpoints', async () => {
      mockRequest.user!.role = 'super_admin';
      mockRequest.user!.permissions = []; // Empty permissions, but super_admin should still have access

      await adminController.getDashboard(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object),
        correlationId: 'test-correlation-id'
      });
    });
  });
});